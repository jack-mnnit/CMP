import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { statusChangeSchema } from "@/lib/validations";
import { changePostStatus } from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await apiUser("posts:publish");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusChangeSchema.safeParse({ ...(body ?? {}), status: "SCHEDULED" });
  if (!parsed.success || !parsed.data.scheduledAt) {
    return jsonError(400, "VALIDATION", "scheduledAt (ISO date) is required");
  }
  try {
    return jsonOk(await changePostStatus(auth.user, id, "SCHEDULED", parsed.data.scheduledAt));
  } catch (error) {
    return handleServiceError(error);
  }
}
