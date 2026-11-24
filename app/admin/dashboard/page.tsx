import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { FileText, Clock, MessageSquare, Eye, Users, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";

export const metadata = { title: "Dashboard" };

async function Stats() {
  const [published, drafts, scheduled, pendingComments, views, users] = await Promise.all([
    prisma.post.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.post.count({ where: { status: "DRAFT", deletedAt: null } }),
    prisma.post.count({ where: { status: "SCHEDULED", deletedAt: null } }),
    prisma.comment.count({ where: { status: "PENDING" } }),
    prisma.post.aggregate({ _sum: { viewCount: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  const cards = [
    { label: "Published posts", value: published, icon: FileText, href: "/admin/posts?status=PUBLISHED" },
    { label: "Drafts", value: drafts, icon: FileText, href: "/admin/posts?status=DRAFT" },
    { label: "Scheduled", value: scheduled, icon: Clock, href: "/admin/posts?status=SCHEDULED" },
    { label: "Pending comments", value: pendingComments, icon: MessageSquare, href: "/admin/comments" },
    { label: "Total views", value: views._sum.viewCount ?? 0, icon: Eye, href: "/admin/analytics" },
    { label: "Users", value: users, icon: Users, href: "/admin/users" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{c.label}</p>
            <c.icon className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-bold">{c.value.toLocaleString()}</p>
        </Link>
      ))}
    </div>
  );
}

async function RecentPosts() {
  const posts = await prisma.post.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, status: true, updatedAt: true, author: { select: { displayName: true } } },
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="font-semibold">Recently updated</h2>
        <Link href="/admin/posts" className="text-sm text-blue-600 hover:underline">View all</Link>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/admin/posts/${p.id}`} className="block truncate font-medium hover:text-blue-600">{p.title}</Link>
              <p className="text-xs text-slate-500">{p.author.displayName} · {formatDate(p.updatedAt)}</p>
            </div>
            <StatusBadge status={p.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  await connection();
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user.displayName}</h1>
          <p className="text-sm text-slate-500">Here is what is happening on your site.</p>
        </div>
        <Link href="/admin/posts/new" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading statistics…</p>}>
        <Stats />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading posts…</p>}>
        <RecentPosts />
      </Suspense>
    </div>
  );
}
