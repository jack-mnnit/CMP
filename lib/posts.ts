import "server-only";
import { Prisma, type PostStatus, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { readingTime, slugify, htmlToText } from "@/lib/utils";
import { renderContentHtml } from "@/lib/content";
import type { PostInput } from "@/lib/validations";

export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const postInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true } },
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: { where: { status: "APPROVED" } } } },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base) || "post";
  let candidate = slug;
  let i = 2;
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${slug}-${i++}`;
  }
}

/** Publishes scheduled posts whose time has come. Safe to call often. */
export async function publishDueScheduledPosts(): Promise<number> {
  const result = await prisma.post.updateMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() }, deletedAt: null },
    data: { status: "PUBLISHED", publishedAt: new Date(), scheduledAt: null },
  });
  if (result.count > 0) {
    await prisma.notification.create({
      data: { message: `${result.count} scheduled post(s) were published`, link: "/admin/posts?status=published" },
    });
  }
  return result.count;
}

export interface PostListQuery {
  page?: number;
  pageSize?: number;
  status?: string; // all | published | draft | pending | scheduled | private | trash
  search?: string;
  sort?: string; // newest | oldest | title-asc | title-desc | author | modified
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  /** When true, only published posts are returned (public site). */
  publicOnly?: boolean;
}

const STATUS_FILTER: Record<string, PostStatus> = {
  published: "PUBLISHED",
  draft: "DRAFT",
  pending: "PENDING",
  scheduled: "SCHEDULED",
  private: "PRIVATE",
};

export async function listPosts(query: PostListQuery) {
  if (!query.publicOnly) await publishDueScheduledPosts();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));

  const where: Prisma.PostWhereInput = { deletedAt: null };
  if (query.publicOnly) {
    where.status = "PUBLISHED";
    where.publishedAt = { lte: new Date() };
  } else if (query.status === "trash") {
    where.status = "TRASH";
  } else if (query.status && STATUS_FILTER[query.status]) {
    where.status = STATUS_FILTER[query.status];
  } else {
    where.status = { not: "TRASH" };
  }
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
      { contentHtml: { contains: q, mode: "insensitive" } },
      { author: { displayName: { contains: q, mode: "insensitive" } } },
      { categories: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
    ];
  }
  if (query.categoryId) where.categories = { some: { categoryId: query.categoryId } };
  if (query.tagId) where.tags = { some: { tagId: query.tagId } };
  if (query.authorId) where.authorId = query.authorId;

  const orderBy: Prisma.PostOrderByWithRelationInput =
    query.sort === "oldest" ? { createdAt: "asc" }
    : query.sort === "title-asc" ? { title: "asc" }
    : query.sort === "title-desc" ? { title: "desc" }
    : query.sort === "author" ? { author: { displayName: "asc" } }
    : query.sort === "modified" ? { updatedAt: "desc" }
    : { publishedAt: { sort: "desc", nulls: "last" } };

  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      orderBy: query.sort && query.sort !== "newest" ? orderBy : [orderBy, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: postInclude,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getPostById(id: string) {
  return prisma.post.findFirst({ where: { id, deletedAt: null }, include: postInclude });
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, publishedAt: { lte: new Date() } },
    include: postInclude,
  });
}

/** Creates or updates a post. Snapshots the previous version as a revision on update. */
export async function savePost(
  user: User,
  input: PostInput,
  postId?: string,
): Promise<PostWithRelations> {
  const contentHtml = input.content ? renderContentHtml(input.content) : input.contentHtml ?? "";
  const plainText = htmlToText(contentHtml);

  if (postId) {
    const existing = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!existing) throw new ServiceError(404, "NOT_FOUND", "Post not found");
    const canEditAny = hasPermission(user.role, "posts:edit-any");
    if (!canEditAny && existing.authorId !== user.id) {
      throw new ServiceError(403, "FORBIDDEN", "You can only edit your own posts");
    }
    if (existing.status === "PENDING" && !canEditAny) {
      throw new ServiceError(409, "LOCKED", "Posts pending review cannot be edited");
    }

    const slug = input.slug && input.slug !== existing.slug
      ? await ensureUniqueSlug(input.slug, postId)
      : existing.slug;

    return prisma.$transaction(async (tx) => {
      // Revision snapshot of the previous state
      const last = await tx.postRevision.findFirst({
        where: { postId }, orderBy: { revisionNo: "desc" }, select: { revisionNo: true },
      });
      await tx.postRevision.create({
        data: {
          postId,
          revisionNo: (last?.revisionNo ?? 0) + 1,
          title: existing.title,
          content: existing.content as Prisma.InputJsonValue,
          contentHtml: existing.contentHtml,
          excerpt: existing.excerpt,
          changeSummary: input.changeSummary ?? "Updated",
          updatedById: user.id,
        },
      });

      // Redirect record when a published URL changes
      if (slug !== existing.slug && existing.status === "PUBLISHED") {
        await tx.redirect.upsert({
          where: { fromPath: `/blog/${existing.slug}` },
          update: { toPath: `/blog/${slug}` },
          create: { fromPath: `/blog/${existing.slug}`, toPath: `/blog/${slug}` },
        });
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          title: input.title,
          slug,
          subtitle: input.subtitle ?? null,
          excerpt: input.excerpt ?? null,
          content: (input.content ?? existing.content) as Prisma.InputJsonValue,
          contentHtml,
          readingTime: readingTime(plainText),
          featuredImage: input.featuredImage ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          focusKeyword: input.focusKeyword ?? null,
          canonicalUrl: input.canonicalUrl || null,
          robotsIndex: input.robotsIndex ?? true,
          robotsFollow: input.robotsFollow ?? true,
          ogImage: input.ogImage ?? null,
          allowComments: input.allowComments ?? true,
          ...(input.authorId && hasPermission(user.role, "posts:edit-any")
            ? { authorId: input.authorId } : {}),
          ...(input.categoryIds ? {
            categories: {
              deleteMany: {},
              create: input.categoryIds.map((categoryId) => ({ categoryId })),
            },
          } : {}),
          ...(input.tagIds ? {
            tags: { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) },
          } : {}),
        },
      });
      return tx.post.findUniqueOrThrow({ where: { id: postId }, include: postInclude });
    });
  }

  // Create
  if (!hasPermission(user.role, "posts:create")) {
    throw new ServiceError(403, "FORBIDDEN", "You do not have permission to create posts");
  }
  const slug = await ensureUniqueSlug(input.slug || input.title);
  const authorId = input.authorId && hasPermission(user.role, "posts:edit-any") ? input.authorId : user.id;

  return prisma.post.create({
    data: {
      title: input.title,
      slug,
      subtitle: input.subtitle ?? null,
      excerpt: input.excerpt ?? null,
      content: (input.content ?? { type: "doc", content: [{ type: "paragraph" }] }) as Prisma.InputJsonValue,
      contentHtml,
      readingTime: readingTime(plainText),
      featuredImage: input.featuredImage ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      focusKeyword: input.focusKeyword ?? null,
      canonicalUrl: input.canonicalUrl || null,
      robotsIndex: input.robotsIndex ?? true,
      robotsFollow: input.robotsFollow ?? true,
      ogImage: input.ogImage ?? null,
      allowComments: input.allowComments ?? true,
      status: "DRAFT",
      authorId,
      categories: { create: (input.categoryIds ?? []).map((categoryId) => ({ categoryId })) },
      tags: { create: (input.tagIds ?? []).map((tagId) => ({ tagId })) },
    },
    include: postInclude,
  });
}

/** Workflow transitions: draft, pending (submit), published, scheduled, private, trash. */
export async function changePostStatus(
  user: User,
  postId: string,
  status: PostStatus,
  scheduledAt?: Date | null,
) {
  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
  if (!post) throw new ServiceError(404, "NOT_FOUND", "Post not found");

  const canEditAny = hasPermission(user.role, "posts:edit-any");
  const isOwner = post.authorId === user.id;
  if (!canEditAny && !isOwner) throw new ServiceError(403, "FORBIDDEN", "Not allowed");

  const canPublish = hasPermission(user.role, "posts:publish") && (canEditAny || isOwner);
  // Contributors submit for review; they cannot publish directly.
  if ((status === "PUBLISHED" || status === "SCHEDULED") && !canPublish) {
    throw new ServiceError(403, "FORBIDDEN", "You are not allowed to publish. Submit for review instead.");
  }
  if (status === "PENDING" && !hasPermission(user.role, "posts:create")) {
    throw new ServiceError(403, "FORBIDDEN", "Not allowed to submit for review");
  }
  if (status === "SCHEDULED") {
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      throw new ServiceError(400, "VALIDATION", "Scheduled time must be in the future");
    }
  }

  const data: Prisma.PostUpdateInput = { status };
  if (status === "PUBLISHED") {
    data.publishedAt = post.publishedAt && post.publishedAt <= new Date() ? post.publishedAt : new Date();
    data.scheduledAt = null;
  }
  if (status === "SCHEDULED") {
    data.scheduledAt = scheduledAt!;
    data.publishedAt = scheduledAt!;
  }
  if (status === "TRASH") data.deletedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.post.update({ where: { id: postId }, data, include: postInclude });
    await tx.notification.create({
      data: { message: `Post "${post.title}" changed to ${status.toLowerCase()}`, link: `/admin/posts/${postId}/edit` },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: `post.status.${status.toLowerCase()}`,
        resourceType: "post",
        resourceId: postId,
        details: `from ${post.status}`,
      },
    });
    return result;
  });
  return updated;
}

/** Restore from trash to draft. */
export async function restorePost(user: User, postId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, status: "TRASH" } });
  if (!post) throw new ServiceError(404, "NOT_FOUND", "Trashed post not found");
  if (!hasPermission(user.role, "posts:edit-any") && post.authorId !== user.id) {
    throw new ServiceError(403, "FORBIDDEN", "Not allowed");
  }
  return prisma.post.update({ where: { id: postId }, data: { status: "DRAFT", deletedAt: null } });
}

export async function permanentlyDeletePost(user: User, postId: string) {
  if (!hasPermission(user.role, "posts:delete")) {
    throw new ServiceError(403, "FORBIDDEN", "You do not have permission to delete posts");
  }
  const post = await prisma.post.findFirst({ where: { id: postId, status: "TRASH" } });
  if (!post) throw new ServiceError(404, "NOT_FOUND", "Only trashed posts can be permanently deleted");
  await prisma.post.delete({ where: { id: postId } });
}

export async function restoreRevision(user: User, postId: string, revisionNo: number) {
  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
  if (!post) throw new ServiceError(404, "NOT_FOUND", "Post not found");
  if (!hasPermission(user.role, "posts:edit-any") && post.authorId !== user.id) {
    throw new ServiceError(403, "FORBIDDEN", "Not allowed");
  }
  const revision = await prisma.postRevision.findUnique({
    where: { postId_revisionNo: { postId, revisionNo } },
  });
  if (!revision) throw new ServiceError(404, "NOT_FOUND", "Revision not found");
  return savePost(
    user,
    {
      title: revision.title,
      content: revision.content,
      contentHtml: revision.contentHtml,
      excerpt: revision.excerpt,
      changeSummary: `Restored revision ${revisionNo}`,
    } as PostInput,
    postId,
  );
}

export async function incrementPostView(postId: string) {
  await prisma.$transaction([
    prisma.post.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    prisma.postView.create({ data: { postId } }),
  ]);
}
