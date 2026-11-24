import "server-only";
import { prisma } from "@/lib/prisma";

/** Options shared by the post editor: categories, tags, and possible authors. */
export async function loadEditorOptions() {
  const [categories, tags, authors] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE", role: { not: "SUBSCRIBER" } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);
  return {
    categories,
    tags,
    authors: authors.map((a) => ({ id: a.id, name: a.displayName })),
  };
}
