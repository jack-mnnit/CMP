import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleServiceError } from "@/lib/api";
import { ServiceError } from "@/lib/posts";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const moderationSchema = z.object({
  status: z.enum(["APPROVED", "PENDING", "SPAM", "TRASH"]).optional(),
  content: z.string().trim().min(2).max(2000).optional(),
  /** Reply as the signed-in moderator */
  reply: z.string().trim().min(2).max(2000).optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await apiUser("comments:moderate");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid moderation data", parsed.error.flatten().fieldErrors);
  try {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new ServiceError(404, "NOT_FOUND", "Comment not found");
    if (parsed.data.reply) {
      const reply = await prisma.comment.create({
        data: {
          postId: comment.postId,
          parentId: comment.id,
          content: parsed.data.reply,
          status: "APPROVED",
          authorName: auth.user.displayName,
          authorEmail: auth.user.email,
          userId: auth.user.id,
        },
      });
      return jsonOk(reply, 201);
    }
    const updated = await prisma.comment.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.content ? { content: parsed.data.content } : {}),
      },
    });
    return jsonOk(updated);
  } catch (error) {
    return handleServiceError(error);
  }
}

/** Trashes a comment; with ?permanent=true a trashed comment is deleted. */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await apiUser("comments:moderate");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  try {
    if (permanent) {
      const comment = await prisma.comment.findUnique({ where: { id } });
      if (!comment) throw new ServiceError(404, "NOT_FOUND", "Comment not found");
      if (comment.status !== "TRASH") throw new ServiceError(409, "NOT_TRASHED", "Move the comment to trash first");
      await prisma.comment.delete({ where: { id } });
      return jsonOk({ id, deleted: true });
    }
    return jsonOk(await prisma.comment.update({ where: { id }, data: { status: "TRASH" } }));
  } catch (error) {
    return handleServiceError(error);
  }
}
