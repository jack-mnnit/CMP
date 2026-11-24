import { requirePermission } from "@/lib/auth";
import { connection } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { loadEditorOptions } from "@/lib/editor-options";
import { PostEditor } from "@/components/editor/post-editor";

export const metadata = { title: "New post" };


export default async function NewPostPage() {
  await connection();
  const user = await requirePermission("posts:create");
  const options = await loadEditorOptions();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <PostEditor
        post={null}
        categories={options.categories}
        tags={options.tags}
        authors={options.authors}
        canPublish={hasPermission(user.role, "posts:publish")}
        canEditAny={hasPermission(user.role, "posts:edit-any")}
      />
    </div>
  );
}
