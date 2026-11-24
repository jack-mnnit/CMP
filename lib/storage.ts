import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sanitizeHtml from "sanitize-html";

/**
 * Storage adapter. Files are written to UPLOAD_DIR and served from /uploads.
 * For production, replace the body with an S3/R2/Blob client; the public URL
 * returned is stored in the database, so the rest of the app is unaffected.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./public/uploads";

export async function saveFile(buffer: Buffer, originalName: string, ext: string) {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const base = originalName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
  const name = `${base}-${randomUUID().slice(0, 8)}.${ext}`;
  await writeFile(path.join(dir, name), buffer);
  return { url: `/uploads/${name}`, fileName: name };
}

export async function deleteStoredFile(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const file = path.basename(url);
  await unlink(path.resolve(/*turbopackIgnore: true*/ process.cwd(), UPLOAD_DIR, file)).catch(() => undefined);
}

const SVG_ALLOWED_TAGS = [
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse",
  "text", "tspan", "defs", "title", "desc", "linearGradient", "radialGradient", "stop", "use", "clipPath",
];

/** Removes scripts, event handlers, foreign objects and external references from SVG. */
export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, {
    allowedTags: SVG_ALLOWED_TAGS,
    allowedAttributes: {
      "*": [
        "fill", "stroke", "stroke-width", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2",
        "width", "height", "viewBox", "points", "transform", "opacity", "id", "class", "offset", "stop-color",
        "xmlns", "font-size", "font-family", "text-anchor", "fill-rule", "clip-rule", "clip-path", "stroke-linecap", "stroke-linejoin",
      ],
      use: ["href"],
    },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  });
}
