import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentInputSchema } from "@/lib/validations";
import { handleServiceError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { htmlToText } from "@/lib/utils";
import { sanitizeContent } from "@/lib/content";

const STATUSES = ["APPROVED", "PENDING", "SPAM", "TRASH"] as const;

export async function GET(request: Request) {
  const auth = await apiUser("comments:moderate");
  if ("error" in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status")?.toUpperCase();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));
  const search = sp.get("search")?.trim();
  const where = {
    ...(status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {}),
    ...(search ? { OR: [
      { content: { contains: search, mode: "insensitive" as const } },
      { authorName: { contains: search, mode: "insensitive" as const } },
      { authorEmail: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { post: { select: { id: true, title: true, slug: true } } },
    }),
    prisma.comment.count({ where }),
  ]);
  return jsonOk(items, 200, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

/** Public endpoint: submit a comment (held for moderation when required). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`comment:${ip}`, 5, 10 * 60_000)) {
    return jsonError(429, "RATE_LIMITED", "You are commenting too quickly. Please wait a few minutes.");
  }
  const parsed = commentInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid comment", parsed.error.flatten().fieldErrors);
  if (htmlToText(parsed.data.content).length === 0) return jsonError(400, "VALIDATION", "Comment is empty");
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: "site" } });
    const post = await prisma.post.findFirst({
      where: { id: parsed.data.postId, status: "PUBLISHED", deletedAt: null },
      select: { id: true, allowComments: true },
    });
    if (!post || !post.allowComments || settings?.allowComments === false) {
      return jsonError(403, "COMMENTS_CLOSED", "Comments are closed for this post");
    }
    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        parentId: parsed.data.parentId || null,
        authorName: parsed.data.authorName,
        authorEmail: parsed.data.authorEmail,
        content: sanitizeContent(parsed.data.content).replace(/<[^>]+>/g, ""),
        status: settings?.requireCommentApproval === false ? "APPROVED" : "PENDING",
        ipAddress: ip,
      },
    });
    await prisma.notification.create({
      data: { message: `New comment from ${comment.authorName}`, link: "/admin/comments" },
    });
    return jsonOk({ id: comment.id, status: comment.status }, 201);
  } catch (error) {
    return handleServiceError(error);
  }
}
