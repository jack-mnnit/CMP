import { prisma } from "@/lib/prisma";
import { newsletterInputSchema } from "@/lib/validations";
import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleServiceError } from "@/lib/api";
import { sendEmail } from "@/lib/email";

/** Public subscribe: double opt-in is simulated by a confirmation email via the mail adapter. */
export async function POST(request: Request) {
  if (!rateLimit(`newsletter:${clientIp(request)}`, 5, 60 * 60_000)) {
    return jsonError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
  }
  const parsed = newsletterInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid email", parsed.error.flatten().fieldErrors);
  const email = parsed.data.email;
  try {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing && existing.status === "confirmed") {
      return jsonError(409, "DUPLICATE", "This email is already subscribed");
    }
    const subscriber = existing
      ? await prisma.newsletterSubscriber.update({ where: { email }, data: { status: "confirmed", confirmedAt: new Date(), unsubscribedAt: null } })
      : await prisma.newsletterSubscriber.create({ data: { email, status: "confirmed", confirmedAt: new Date() } });
    await sendEmail({
      to: email,
      subject: "You're subscribed to BlogMaster",
      text: "Thanks for subscribing. You can unsubscribe at any time from any email we send.",
    });
    return jsonOk({ id: subscriber.id, subscribed: true }, 201);
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function GET(request: Request) {
  const auth = await apiUser("settings:manage");
  if ("error" in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const search = sp.get("search")?.trim();
  const items = await prisma.newsletterSubscriber.findMany({
    where: search ? { email: { contains: search, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  if (sp.get("format") === "csv") {
    const csv = ["email,status,subscribed_at", ...items.map((i) => `${i.email},${i.status},${i.createdAt.toISOString()}`)].join("\n");
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=subscribers.csv" },
    });
  }
  return jsonOk(items);
}
