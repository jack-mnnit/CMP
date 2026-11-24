import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";

// Auth runs before any streaming, so redirects are real HTTP 307s, not browser-side navigations.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role === "SUBSCRIBER") redirect("/");

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);

  return (
    <AdminShell
      user={{ id: user.id, displayName: user.displayName, email: user.email, role: user.role, avatarUrl: user.avatarUrl }}
      notifications={notifications.map((n) => ({
        id: n.id,
        message: n.message,
        link: n.link,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      }))}
      unreadCount={unreadCount}
    >
      {children}
    </AdminShell>
  );
}
