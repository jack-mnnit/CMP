import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { changePostStatus } from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:publish");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    return jsonOk(await changePostStatus(auth.user, id, "PUBLISHED"));
  } catch (error) {
    return handleServiceError(error);
  }
}
