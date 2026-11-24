import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { createSession, destroySession, verifyPassword, jsonError, jsonOk } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) {
    return jsonError(429, "RATE_LIMITED", "Too many login attempts. Try again in 15 minutes.");
  }
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Invalid input", parsed.error.flatten().fieldErrors);
  }
  const { email, password, remember } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown user / wrong password to avoid account enumeration
  const valid = user && (await verifyPassword(password, user.passwordHash));
  if (!user || !valid || user.deletedAt) {
    return jsonError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  if (user.status !== "ACTIVE") {
    return jsonError(403, "ACCOUNT_SUSPENDED", "This account is suspended");
  }
  await createSession(user.id, Boolean(remember));
  await prisma.auditLog.create({
    data: { userId: user.id, action: "auth.login", resourceType: "user", resourceId: user.id },
  });
  return jsonOk({ id: user.id, email: user.email, role: user.role });
}

export async function DELETE() {
  await destroySession();
  return jsonOk({ loggedOut: true });
}
