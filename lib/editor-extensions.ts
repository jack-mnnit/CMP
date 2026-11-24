import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";

/**
 * Shared Tiptap schema. Used by the browser editor AND the server renderer,
 * so the stored JSON always renders identically.
 */
export const editorExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, underline: false }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "nofollow noopener" } }),
  Image.configure({ allowBase64: false, HTMLAttributes: { loading: "lazy" } }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: false }),
];
