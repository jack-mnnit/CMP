import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;


/** Notifications link to /edit; the editor lives at /admin/posts/[id]. */
export default async function LegacyEditRedirect({ params }: { params: Params }) {
  const { id } = await params;
  redirect(`/admin/posts/${id}`);
}
