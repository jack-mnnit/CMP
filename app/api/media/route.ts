import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFile, sanitizeSvg } from "@/lib/storage";
import { handleServiceError } from "@/lib/api";

const MAX_BYTES = 25 * 1024 * 1024;

/** Allowed extensions with their expected MIME type and magic-byte signature (null = text-based). */
const ALLOWED: Record<string, { mime: string; magic: number[] | null }> = {
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  gif: { mime: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  webp: { mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
  svg: { mime: "image/svg+xml", magic: null },
  mp4: { mime: "video/mp4", magic: null },
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [0x50, 0x4b, 0x03, 0x04] },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: [0x50, 0x4b, 0x03, 0x04] },
};

function matchesMagic(buf: Buffer, magic: number[]) {
  return magic.every((byte, i) => buf[i] === byte);
}

export async function GET(request: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 24)));
  const search = sp.get("search")?.trim();
  const type = sp.get("type"); // image | video | document
  const sort = sp.get("sort") === "oldest" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  if (search) where.OR = [
    { fileName: { contains: search, mode: "insensitive" } },
    { altText: { contains: search, mode: "insensitive" } },
    { title: { contains: search, mode: "insensitive" } },
  ];
  if (type === "image") where.mimeType = { startsWith: "image/" };
  if (type === "video") where.mimeType = { startsWith: "video/" };
  if (type === "document") where.mimeType = { startsWith: "application/" };

  const [items, total] = await prisma.$transaction([
    prisma.media.findMany({ where, orderBy: { createdAt: sort }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.media.count({ where }),
  ]);
  return jsonOk(items, 200, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

/** Multipart upload. Field name: "file" (repeat for multiple files). */
export async function POST(request: Request) {
  const auth = await apiUser("media:upload");
  if ("error" in auth) return auth.error;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "VALIDATION", "Expected multipart/form-data");
  }
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError(400, "VALIDATION", "No file provided");
  if (files.length > 20) return jsonError(400, "VALIDATION", "Maximum 20 files per request");

  const created = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const file of files) {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const rule = ALLOWED[ext];
    if (!rule) { rejected.push({ name: file.name, reason: "File type not allowed" }); continue; }
    if (file.size === 0 || file.size > MAX_BYTES) {
      rejected.push({ name: file.name, reason: "File must be between 1 byte and 25 MB" }); continue;
    }
    let buffer = Buffer.from(await file.arrayBuffer());
    if (rule.magic && !matchesMagic(buffer, rule.magic)) {
      rejected.push({ name: file.name, reason: "File content does not match its extension" }); continue;
    }
    if (ext === "svg") {
      const cleaned = sanitizeSvg(buffer.toString("utf8"));
      if (!cleaned.includes("<svg")) { rejected.push({ name: file.name, reason: "Invalid SVG" }); continue; }
      buffer = Buffer.from(cleaned, "utf8");
    }
    const stored = await saveFile(buffer, file.name, ext);
    const media = await prisma.media.create({
      data: {
        fileName: file.name,
        url: stored.url,
        mimeType: rule.mime,
        size: buffer.length,
        title: file.name.replace(/\.[^.]+$/, ""),
        uploadedById: auth.user.id,
      },
    });
    created.push(media);
  }
  return jsonOk({ created, rejected }, created.length ? 201 : 400);
}
