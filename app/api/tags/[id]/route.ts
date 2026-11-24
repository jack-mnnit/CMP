import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tagInputSchema } from "@/lib/validations";
import { ensureTaxonomySlug } from "@/lib/taxonomy";
import { handleServiceError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = tagInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid tag", parsed.error.flatten().fieldErrors);
  try {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.slug || parsed.data.name) {
      data.slug = await ensureTaxonomySlug("tag", parsed.data.slug || parsed.data.name!, id);
    }
    return jsonOk(await prisma.tag.update({ where: { id }, data }));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    // PostTag rows cascade; posts themselves are untouched.
    await prisma.tag.delete({ where: { id } });
    return jsonOk({ id, deleted: true });
  } catch (error) {
    return handleServiceError(error);
  }
}
