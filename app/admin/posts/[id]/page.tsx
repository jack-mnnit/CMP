import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPostById } from "@/lib/posts";
import { loadEditorOptions } from "@/lib/editor-options";
import { PostEditor, type EditablePost } from "@/components/editor/post-editor";

export const metadata = { title: "Edit post" };

type Params = Promise<{ id: string }>;


export default async function EditPostPage({ params }: { params: Params }) {
  await connection();
  const user = await requirePermission("posts:create");
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();
  if (!hasPermission(user.role, "posts:edit-any") && post.authorId !== user.id) notFound();

  const options = await loadEditorOptions();
  const editable: EditablePost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    subtitle: post.subtitle,
    excerpt: post.excerpt,
    content: post.content,
    status: post.status,
    featuredImage: post.featuredImage,
    categoryIds: post.categories.map((c) => c.categoryId),
    tagIds: post.tags.map((t) => t.tagId),
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    focusKeyword: post.focusKeyword,
    canonicalUrl: post.canonicalUrl,
    robotsIndex: post.robotsIndex,
    robotsFollow: post.robotsFollow,
    allowComments: post.allowComments,
    authorId: post.authorId,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostEditor
        post={editable}
        categories={options.categories}
        tags={options.tags}
        authors={options.authors}
        canPublish={hasPermission(user.role, "posts:publish")}
        canEditAny={hasPermission(user.role, "posts:edit-any")}
      />
    </div>
  );
}
