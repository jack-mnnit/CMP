import { prisma } from "@/lib/prisma";
import { settingsInputSchema } from "@/lib/validations";
import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { handleServiceError } from "@/lib/api";

export async function GET() {
  const auth = await apiUser("settings:manage");
  if ("error" in auth) return auth.error;
  const settings = await prisma.siteSettings.upsert({ where: { id: "site" }, update: {}, create: { id: "site" } });
  return jsonOk(settings);
}

export async function PATCH(request: Request) {
  const auth = await apiUser("settings:manage");
  if ("error" in auth) return auth.error;
  const parsed = settingsInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid settings", parsed.error.flatten().fieldErrors);
  try {
    const settings = await prisma.siteSettings.upsert({
      where: { id: "site" },
      update: parsed.data,
      create: { id: "site", ...parsed.data },
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "settings.update", resourceType: "settings", resourceId: "site" },
    });
    return jsonOk(settings);
  } catch (error) {
    return handleServiceError(error);
  }
}
