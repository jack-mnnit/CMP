import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "bm_session";
const DEFAULT_TTL = 60 * 60 * 8; // 8 hours
const REMEMBER_TTL = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, remember: boolean) {
  const ttl = remember ? REMEMBER_TTL : DEFAULT_TTL;
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Only mark the cookie Secure when the site is served over HTTPS, otherwise browsers drop it on http:// pages.
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: ttl,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Returns the active, non-deleted user for the current session, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
    if (!user || user.deletedAt || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect("/admin/dashboard?forbidden=1");
  return user;
}

export function roleAtLeastEditor(role: Role) {
  return hasPermission(role, "posts:edit-any");
}

/** API-friendly variant: returns the user or a Response to return immediately. */
export async function apiUser(permission?: Permission): Promise<{ user: User } | { error: Response }> {
  const user = await getCurrentUser();
  if (!user) return { error: jsonError(401, "UNAUTHORIZED", "Authentication required") };
  if (permission && !hasPermission(user.role, permission)) {
    return { error: jsonError(403, "FORBIDDEN", "You do not have permission for this action") };
  }
  return { user };
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ success: false, error: { code, message, details } }, { status });
}

export function jsonOk<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  return Response.json({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}
