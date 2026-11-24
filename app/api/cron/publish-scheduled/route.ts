import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishDueScheduledPosts } from "@/lib/posts";

/**
 * Scheduled publishing endpoint. Call every minute from cron (e.g. Vercel Cron,
 * system crontab): curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/publish-scheduled
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } }, { status: 401 });
  }
  const published = await publishDueScheduledPosts();
  await prisma.auditLog.create({
    data: { action: "cron.publish-scheduled", resourceType: "post", details: `published=${published}` },
  });
  return NextResponse.json({ success: true, data: { published } });
}
