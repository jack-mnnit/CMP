import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tagInputSchema } from "@/lib/validations";
import { ensureTaxonomySlug } from "@/lib/taxonomy";
import { handleServiceError } from "@/lib/api";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const search = sp.get("search")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? 50)));
  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { posts: true } } },
    }),
    prisma.tag.count({ where }),
  ]);
  return jsonOk(items, 200, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  const auth = await apiUser("taxonomy:manage");
  if ("error" in auth) return auth.error;
  const parsed = tagInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid tag", parsed.error.flatten().fieldErrors);
  try {
    const slug = await ensureTaxonomySlug("tag", parsed.data.slug || parsed.data.name);
    return jsonOk(await prisma.tag.create({ data: { ...parsed.data, slug } }), 201);
  } catch (error) {
    return handleServiceError(error);
  }
}
