import { prisma } from "@/lib/prisma";
import { contactInputSchema, newsletterInputSchema, settingsInputSchema } from "@/lib/validations";
import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleServiceError } from "@/lib/api";

export async function POST(request: Request) {
  if (!rateLimit(`contact:${clientIp(request)}`, 5, 60 * 60_000)) {
    return jsonError(429, "RATE_LIMITED", "Too many messages. Please try again later.");
  }
  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Invalid submission", parsed.error.flatten().fieldErrors);
  try {
    const { website: _honeypot, ...data } = parsed.data;
    void _honeypot;
    const submission = await prisma.contactSubmission.create({ data });
    await prisma.notification.create({
      data: { message: `Contact form: ${data.subject}`, link: "/admin/contact" },
    });
    return jsonOk({ id: submission.id, received: true }, 201);
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function GET() {
  const auth = await apiUser("contact:view");
  if ("error" in auth) return auth.error;
  const items = await prisma.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return jsonOk(items);
}
