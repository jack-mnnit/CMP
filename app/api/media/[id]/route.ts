import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  fileName: z.string().trim().min(1).max(200).optional(),
  altText: z.string().max(300).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await apiUser("media:upload");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid media data", parsed.error.flatten().fieldErrors);
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return jsonError(404, "NOT_FOUND", "Media not found");
  return jsonOk(await prisma.media.update({ where: { id }, data: parsed.data }));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await apiUser("media:upload");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return jsonError(404, "NOT_FOUND", "Media not found");
  await prisma.media.delete({ where: { id } });
  await deleteStoredFile(media.url);
  return jsonOk({ id, deleted: true });
}
