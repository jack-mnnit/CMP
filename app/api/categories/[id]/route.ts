import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryInputSchema } from "@/lib/validations";
import { ensureTaxonomySlug } from "@/lib/taxonomy";
import { handleServiceError } from "@/lib/api";
import { ServiceError } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = categoryInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid category", parsed.error.flatten().fieldErrors);
  try {
    if (parsed.data.parentId === id) throw new ServiceError(400, "VALIDATION", "A category cannot be its own parent");
    const data = { ...parsed.data, parentId: parsed.data.parentId || null } as Record<string, unknown>;
    if (parsed.data.slug || parsed.data.name) {
      data.slug = await ensureTaxonomySlug("category", parsed.data.slug || parsed.data.name!, id);
    }
    return jsonOk(await prisma.category.update({ where: { id }, data }));
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Deletes a category. Posts are NOT deleted: they are reassigned to
 * `reassignTo` (or to the parent category). Required when posts exist.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const reassignTo = new URL(request.url).searchParams.get("reassignTo");
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true, children: true } } },
    });
    if (!category) return jsonError(404, "NOT_FOUND", "Category not found");
    if (category._count.children > 0) {
      return jsonError(409, "HAS_CHILDREN", "Move or delete child categories first");
    }
    await prisma.$transaction(async (tx) => {
      if (category._count.posts > 0) {
        const target = reassignTo || (await tx.category.findUnique({ where: { id }, select: { parentId: true } }))?.parentId;
        if (!target) {
          throw new ServiceError(409, "HAS_POSTS", "Category has posts. Provide reassignTo to move them.");
        }
        const links = await tx.postCategory.findMany({ where: { categoryId: id }, select: { postId: true } });
        for (const { postId } of links) {
          await tx.postCategory.upsert({
            where: { postId_categoryId: { postId, categoryId: target } },
            update: {},
            create: { postId, categoryId: target },
          });
        }
      }
      await tx.category.delete({ where: { id } });
    });
    return jsonOk({ id, deleted: true });
  } catch (error) {
    return handleServiceError(error);
  }
}
