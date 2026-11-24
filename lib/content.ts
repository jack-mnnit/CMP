import "server-only";
import { generateHTML } from "@tiptap/html";
import sanitizeHtml from "sanitize-html";
import { editorExtensions } from "@/lib/editor-extensions";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "u", "s", "mark", "code", "pre",
  "blockquote", "ul", "ol", "li", "hr", "br", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td", "iframe", "div", "span", "button",
];

/** Converts Tiptap JSON into sanitized HTML safe for public rendering. */
export function renderContentHtml(doc: unknown): string {
  let html = "";
  try {
    html = generateHTML(doc as Parameters<typeof generateHTML>[0], editorExtensions);
  } catch {
    html = "";
  }
  return sanitizeContent(html);
}

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
      "*": ["class", "style", "id", "data-align", "data-type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com", "www.youtube-nocookie.com"],
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], color: [/.*/], "background-color": [/.*/] } },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: attribs.target === "_blank" ? "noopener noreferrer" : "nofollow",
        },
      }),
    },
  });
}
