import type { Role } from "@prisma/client";

export type Permission =
  | "posts:create"
  | "posts:edit-own"
  | "posts:edit-any"
  | "posts:publish"
  | "posts:delete"
  | "posts:review"
  | "taxonomy:manage"
  | "media:upload"
  | "comments:moderate"
  | "users:manage"
  | "settings:manage"
  | "contact:view";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "posts:create", "posts:edit-own", "posts:edit-any", "posts:publish", "posts:delete",
    "posts:review", "taxonomy:manage", "media:upload", "comments:moderate",
    "users:manage", "settings:manage", "contact:view",
  ],
  ADMIN: [
    "posts:create", "posts:edit-own", "posts:edit-any", "posts:publish", "posts:delete",
    "posts:review", "taxonomy:manage", "media:upload", "comments:moderate",
    "users:manage", "settings:manage", "contact:view",
  ],
  EDITOR: [
    "posts:create", "posts:edit-own", "posts:edit-any", "posts:publish", "posts:delete",
    "posts:review", "taxonomy:manage", "media:upload", "comments:moderate", "contact:view",
  ],
  AUTHOR: ["posts:create", "posts:edit-own", "posts:publish", "media:upload"],
  CONTRIBUTOR: ["posts:create", "posts:edit-own"],
  SUBSCRIBER: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function roleLabel(role: Role): string {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}
