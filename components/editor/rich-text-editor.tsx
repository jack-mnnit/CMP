"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2,
  Highlighter, Minus,
} from "lucide-react";
import { editorExtensions } from "@/lib/editor-extensions";
import { cn } from "@/lib/utils";

interface Props {
  initialContent: unknown;
  onChange: (json: unknown) => void;
  onUploadRequest?: () => void;
}

export function RichTextEditor({ initialContent, onChange, onUploadRequest }: Props) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent as object,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor min-h-[420px] px-5 py-4 outline-none",
        "aria-label": "Post content",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) return <div className="min-h-[420px] rounded-md border border-slate-200 dark:border-slate-700" />;

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
      <Toolbar editor={editor} onUploadRequest={onUploadRequest} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Btn({
  active, onClick, label, children, disabled,
}: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800",
        active && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onUploadRequest }: { editor: Editor; onUploadRequest?: () => void }) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|\/|mailto:)/.test(url)) {
      window.alert("Links must start with https://, http://, / or mailto:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    if (onUploadRequest) return onUploadRequest();
    const url = window.prompt("Image URL (https://…)");
    if (url && /^https?:\/\//.test(url)) editor.chain().focus().setImage({ src: url, alt: "" }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-4 w-4" /></Btn>
      <Btn label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-4 w-4" /></Btn>
      <Sep />
      <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
      <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
      <Btn label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
      <Btn label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></Btn>
      <Btn label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></Btn>
      <Sep />
      <Btn label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Btn>
      <Btn label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Btn>
      <Btn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
      <Btn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
      <Btn label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
      <Sep />
      <Btn label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Btn>
      <Btn label="Align centre" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Btn>
      <Btn label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Btn>
      <Sep />
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="h-4 w-4" /></Btn>
      <Btn label="Image" onClick={addImage}><ImageIcon className="h-4 w-4" /></Btn>
      <Btn
        label="Insert table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <span className="px-1 text-xs font-semibold">Table</span>
      </Btn>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" aria-hidden />;
}
