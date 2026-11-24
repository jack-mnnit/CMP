"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Image as ImageIcon, FolderTree, Tags, MessageSquare, Users,
  Palette, Puzzle, BarChart3, Search as SearchIcon, Settings, Menu, X, Plus, Bell, Globe,
  LogOut, Mail, Search, ChevronRight, Sun, Moon,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare },
  { href: "/admin/contact", label: "Contact", icon: Mail },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const PLACEHOLDER_NAV = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/appearance", label: "Appearance", icon: Palette },
  { href: "/admin/plugins", label: "Plugins", icon: Puzzle },
  { href: "/admin/seo", label: "SEO", icon: SearchIcon },
];

const CREATE_OPTIONS = [
  { href: "/admin/posts/new", label: "New Post" },
  { href: "/admin/media", label: "Upload Media" },
  { href: "/admin/categories", label: "New Category" },
  { href: "/admin/tags", label: "New Tag" },
];

interface Props {
  user: { id: string; displayName: string; email: string; role: string; avatarUrl: string | null };
  notifications: { id: string; message: string; link: string | null; read: boolean; createdAt: string }[];
  unreadCount: number;
  children: ReactNode;
}

export function AdminShell({ user, notifications, unreadCount, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "create" | "notify" | "user">(null);
  const [dark, setDark] = useState(false);

  const toggleDark = () => {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const crumbs = pathname.split("/").filter(Boolean).slice(1);
  const navItem = (item: (typeof NAV)[number]) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
          collapsed && "justify-center px-2",
        )}
        title={item.label}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className={cn("flex min-h-screen", dark && "dark")}>
      <Toaster richColors position="top-right" />
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-100 transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
          <Globe className="h-5 w-5 text-blue-400" />
          {!collapsed && <span className="font-bold">BlogMaster CMS</span>}
          <button className="ml-auto text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Admin navigation">
          {NAV.map(navItem)}
          <div className={cn("my-2 border-t border-slate-800", collapsed && "mx-2")} />
          {PLACEHOLDER_NAV.map(navItem)}
        </nav>
        <p className="border-t border-slate-800 p-3 text-xs text-slate-500">{collapsed ? "" : `Signed in as ${roleLabel(user.role as never)}`}</p>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={cn("flex min-w-0 flex-1 flex-col transition-all duration-200", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => { setMobileOpen((v) => !v); setCollapsed((c) => !c); }}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch />
          <div className="relative">
            <button
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
              onClick={() => setOpenMenu(openMenu === "create" ? null : "create")}
              aria-haspopup="menu"
              aria-expanded={openMenu === "create"}
            >
              <Plus className="h-4 w-4" /> Create New
            </button>
            {openMenu === "create" && (
              <Dropdown onClose={() => setOpenMenu(null)}>
                {CREATE_OPTIONS.map((o) => (
                  <Link key={o.href} href={o.href} className="block rounded px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpenMenu(null)}>
                    {o.label}
                  </Link>
                ))}
              </Dropdown>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/" target="_blank" className="hidden items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100 sm:flex dark:hover:bg-slate-800">
              <Globe className="h-4 w-4" /> Visit Website
            </Link>
            <button onClick={toggleDark} className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button className="relative rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpenMenu(openMenu === "notify" ? null : "notify")} aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </button>
              {openMenu === "notify" && (
                <Dropdown onClose={() => setOpenMenu(null)} wide>
                  <p className="px-3 py-2 text-sm font-semibold">Notifications</p>
                  {notifications.length === 0 && <p className="px-3 pb-3 text-sm text-slate-500">No notifications yet.</p>}
                  {notifications.map((n) => (
                    <Link key={n.id} href={n.link ?? "/admin/dashboard"} className={cn("block rounded px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800", !n.read && "font-medium")} onClick={() => setOpenMenu(null)}>
                      {n.message}
                      <span className="block text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                    </Link>
                  ))}
                </Dropdown>
              )}
            </div>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpenMenu(openMenu === "user" ? null : "user")} aria-haspopup="menu">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium md:inline">{user.displayName}</span>
              </button>
              {openMenu === "user" && (
                <Dropdown onClose={() => setOpenMenu(null)}>
                  <p className="px-3 py-2 text-xs text-slate-500">{user.email}</p>
                  <Link href="/admin/profile" className="block rounded px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpenMenu(null)}>Edit profile</Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </Dropdown>
              )}
            </div>
          </div>
        </header>

        <div className="px-4 pt-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            <Link href="/admin/dashboard" className="hover:text-slate-900">Admin</Link>
            {crumbs.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <span className="capitalize">{decodeURIComponent(c).replace(/-/g, " ")}</span>
              </span>
            ))}
          </nav>
        </div>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function Dropdown({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div role="menu" className={cn("absolute right-0 top-full z-50 mt-2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900", wide ? "w-80" : "w-52")}>
        {children}
      </div>
    </>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative hidden max-w-md flex-1 md:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/admin/posts?search=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search posts…"
        aria-label="Global search"
        className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800"
      />
    </form>
  );
}
