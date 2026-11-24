import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { restoreRevision } from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!post) return jsonError(404, "NOT_FOUND", "Post not found");
  if (!hasPermission(auth.user.role, "posts:edit-any") && post.authorId !== auth.user.id) {
    return jsonError(403, "FORBIDDEN", "Not allowed");
  }
  const revisions = await prisma.postRevision.findMany({
    where: { postId: id },
    orderBy: { revisionNo: "desc" },
    select: {
      id: true, revisionNo: true, title: true, contentHtml: true, changeSummary: true,
      createdAt: true, updatedBy: { select: { id: true, displayName: true } },
    },
  });
  return jsonOk(revisions, 200, { total: revisions.length });
}

/** Restores a revision by number. Current state is saved as a new revision first. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:create");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { revisionNo?: number } | null;
  if (!body?.revisionNo || !Number.isInteger(body.revisionNo)) {
    return jsonError(400, "VALIDATION", "revisionNo is required");
  }
  try {
    const post = await restoreRevision(auth.user, id, body.revisionNo);
    return jsonOk(post);
  } catch (error) {
    return handleServiceError(error);
  }
}
