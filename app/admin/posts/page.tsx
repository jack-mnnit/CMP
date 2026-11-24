import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listPosts } from "@/lib/posts";
import { formatDate } from "@/lib/utils";
import { Button, EmptyState, StatusBadge } from "@/components/ui";
import { PostRowActions } from "@/components/admin/post-row-actions";

export const metadata = { title: "Posts" };

const TABS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "Pending review" },
  { key: "scheduled", label: "Scheduled" },
  { key: "private", label: "Private" },
  { key: "trash", label: "Trash" },
];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "modified", label: "Recently modified" },
  { key: "title-asc", label: "Title A–Z" },
  { key: "title-desc", label: "Title Z–A" },
];

type SearchParams = Promise<{ status?: string; search?: string; sort?: string; page?: string }>;


export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const user = await requirePermission("posts:create");
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const search = sp.search?.trim() ?? "";
  const sort = sp.sort ?? "newest";
  const page = Number(sp.page ?? 1) || 1;
  const ownOnly = !hasPermission(user.role, "posts:edit-any");

  const result = await listPosts({
    status,
    search,
    sort,
    page,
    pageSize: 15,
    authorId: ownOnly ? user.id : undefined,
  });

  const href = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, search, sort, page: 1, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== "all" && !(k === "page" && v === 1)) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/admin/posts?${qs}` : "/admin/posts";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Link href="/admin/posts/new" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add new post
        </Link>
      </div>

      <nav aria-label="Post status" className="flex flex-wrap gap-1 border-b border-slate-200 text-sm dark:border-slate-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ status: t.key, page: 1 })}
            aria-current={status === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${status === t.key ? "border-blue-600 font-medium text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <input
          name="search"
          defaultValue={search}
          placeholder="Search title, content, author, category, tag…"
          aria-label="Search posts"
          className="h-10 min-w-64 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <select name="sort" defaultValue={sort} aria-label="Sort" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {result.items.length === 0 ? (
          <EmptyState title="No posts found" description="Try a different filter, or create a new post." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Categories</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.items.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/posts/${post.id}`} className="font-medium hover:text-blue-600">{post.title}</Link>
                    <p className="text-xs text-slate-500">/{post.slug} · {post.viewCount} views · {post._count.comments} comments</p>
                  </td>
                  <td className="px-4 py-3">{post.author.displayName}</td>
                  <td className="px-4 py-3">{post.categories.map((c) => c.category.name).join(", ") || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(post.publishedAt ?? post.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <PostRowActions id={post.id} inTrash={post.status === "TRASH"} canDelete={hasPermission(user.role, "posts:delete")} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{result.pagination.total} posts</span>
        {result.pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && <Link className="rounded border px-3 py-1 hover:bg-slate-50" href={href({ page: page - 1 })}>Previous</Link>}
            <span>Page {page} of {result.pagination.totalPages}</span>
            {page < result.pagination.totalPages && <Link className="rounded border px-3 py-1 hover:bg-slate-50" href={href({ page: page + 1 })}>Next</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
