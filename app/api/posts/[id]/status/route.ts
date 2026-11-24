import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { statusChangeSchema } from "@/lib/validations";
import { changePostStatus, restorePost } from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Generic workflow endpoint: draft, pending, published, scheduled, private, trash. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:create");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Invalid status", parsed.error.flatten().fieldErrors);
  }
  try {
    const post = await changePostStatus(auth.user, id, parsed.data.status, parsed.data.scheduledAt ?? null);
    return jsonOk(post);
  } catch (error) {
    return handleServiceError(error);
  }
}

/** Restore a trashed post back to draft. */
export async function PUT(_request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:create");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    return jsonOk(await restorePost(auth.user, id));
  } catch (error) {
    return handleServiceError(error);
  }
}
