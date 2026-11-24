import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/** Generates a unique slug for categories or tags. */
export async function ensureTaxonomySlug(
  kind: "category" | "tag",
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || kind;
  let candidate = root;
  let i = 2;
  while (true) {
    const existing = kind === "category"
      ? await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })
      : await prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${i++}`;
  }
}
