import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { postInputSchema } from "@/lib/validations";
import {
  getPostById, savePost, permanentlyDeletePost, changePostStatus,
} from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) return jsonError(404, "NOT_FOUND", "Post not found");
  return jsonOk(post);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:create");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = postInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Invalid post data", parsed.error.flatten().fieldErrors);
  }
  try {
    const post = await savePost(auth.user, parsed.data as never, id);
    return jsonOk(post);
  } catch (error) {
    return handleServiceError(error);
  }
}

/** DELETE moves to trash. With ?permanent=true a trashed post is removed for good. */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:delete");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  try {
    if (permanent) {
      await permanentlyDeletePost(auth.user, id);
      return jsonOk({ id, deleted: true });
    }
    const post = await changePostStatus(auth.user, id, "TRASH");
    return jsonOk(post);
  } catch (error) {
    return handleServiceError(error);
  }
}
