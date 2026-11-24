import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryInputSchema } from "@/lib/validations";
import { ensureTaxonomySlug } from "@/lib/taxonomy";
import { handleServiceError } from "@/lib/api";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const search = sp.get("search")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));
  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { parent: { select: { id: true, name: true } }, _count: { select: { posts: true } } },
    }),
    prisma.category.count({ where }),
  ]);
  return jsonOk(items, 200, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const parsed = categoryInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid category", parsed.error.flatten().fieldErrors);
  try {
    const slug = await ensureTaxonomySlug("category", parsed.data.slug || parsed.data.name);
    const category = await prisma.category.create({
      data: { ...parsed.data, slug, parentId: parsed.data.parentId || null },
    });
    return jsonOk(category, 201);
  } catch (error) {
    return handleServiceError(error);
  }
}
