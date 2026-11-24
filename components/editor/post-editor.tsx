"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Send, Globe, Clock, EyeOff, Trash2, History, RotateCcw, Upload, Eye } from "lucide-react";
import { Button, Card, Input, Textarea, StatusBadge } from "@/components/ui";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { formatDate } from "@/lib/utils";

export interface EditablePost {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  content: unknown;
  status: string;
  featuredImage: string | null;
  categoryIds: string[];
  tagIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  focusKeyword: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  allowComments: boolean;
  authorId: string;
  scheduledAt: string | null;
  updatedAt: string;
}

interface Option { id: string; name: string }

interface Props {
  post: EditablePost | null;
  categories: Option[];
  tags: Option[];
  authors: Option[];
  canPublish: boolean;
  canEditAny: boolean;
}

interface FormState {
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  content: unknown;
  featuredImage: string;
  categoryIds: string[];
  tagIds: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  allowComments: boolean;
  authorId: string;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function initialState(post: EditablePost | null, authors: Option[]): FormState {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    subtitle: post?.subtitle ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? EMPTY_DOC,
    featuredImage: post?.featuredImage ?? "",
    categoryIds: post?.categoryIds ?? [],
    tagIds: post?.tagIds ?? [],
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    focusKeyword: post?.focusKeyword ?? "",
    canonicalUrl: post?.canonicalUrl ?? "",
    robotsIndex: post?.robotsIndex ?? true,
    robotsFollow: post?.robotsFollow ?? true,
    allowComments: post?.allowComments ?? true,
    authorId: post?.authorId ?? authors[0]?.id ?? "",
  };
}

export function PostEditor({ post, categories, tags, authors, canPublish, canEditAny }: Props) {
  const router = useRouter();
  const storageKey = `bm-draft:${post?.id ?? "new"}`;
  const [form, setForm] = useState<FormState>(() => initialState(post, authors));
  const [postId, setPostId] = useState<string | null>(post?.id ?? null);
  const [status, setStatus] = useState<string>(post?.status ?? "DRAFT");
  const [scheduleAt, setScheduleAt] = useState<string>(post?.scheduledAt ? toLocalInput(post.scheduledAt) : "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }, []);

  // Local backup on every change, so work survives a crash or reload
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ form, savedAt: new Date().toISOString() }));
    } catch {
      /* storage full or disabled */
    }
  }, [form, dirty, storageKey]);

  useEffect(() => {
    setHasLocalBackup(Boolean(localStorage.getItem(storageKey)));
  }, [storageKey]);

  const restoreLocal = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { form: FormState };
      setForm(parsed.form);
      setDirty(true);
      setSlugTouched(true);
      toast.success("Local draft restored. Save to keep it.");
    } catch {
      toast.error("Local draft is corrupt");
    }
    setHasLocalBackup(false);
  };

  const discardLocal = () => {
    localStorage.removeItem(storageKey);
    setHasLocalBackup(false);
  };

  const payload = useMemo(() => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    subtitle: form.subtitle || null,
    excerpt: form.excerpt || null,
    content: form.content,
    featuredImage: form.featuredImage || null,
    categoryIds: form.categoryIds,
    tagIds: form.tagIds,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null,
    focusKeyword: form.focusKeyword || null,
    canonicalUrl: form.canonicalUrl || "",
    robotsIndex: form.robotsIndex,
    robotsFollow: form.robotsFollow,
    allowComments: form.allowComments,
    ...(canEditAny && form.authorId ? { authorId: form.authorId } : {}),
  }), [form, canEditAny]);

  /** Saves metadata and content. Creates the post on first save. */
  const save = useCallback(async (opts?: { silent?: boolean }) => {
    if (!payload.title) {
      if (!opts?.silent) toast.error("A title is required before saving");
      return null;
    }
    setSaving(true);
    try {
      const url = postId ? `/api/posts/${postId}` : "/api/posts";
      const res = await fetch(url, {
        method: postId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json?.error?.message ?? "Save failed";
        if (!opts?.silent) toast.error(msg);
        return null;
      }
      const saved = json.data as { id: string; status: string; slug: string };
      localStorage.removeItem(storageKey);
      setHasLocalBackup(false);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      setStatus(saved.status);
      setForm((f) => ({ ...f, slug: saved.slug }));
      if (!postId) {
        setPostId(saved.id);
        router.replace(`/admin/posts/${saved.id}`);
      }
      if (!opts?.silent) toast.success("Saved");
      return saved;
    } catch {
      if (!opts?.silent) toast.error("Network error while saving");
      return null;
    } finally {
      setSaving(false);
    }
  }, [payload, postId, router, storageKey]);

  // Autosave every 20 seconds while there are unsaved changes
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || !postId) return;
    const t = setTimeout(() => { void saveRef.current({ silent: true }); }, 20000);
    return () => clearTimeout(t);
  }, [dirty, form, postId]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const changeStatus = async (next: string, scheduled?: string) => {
    const saved = await save();
    if (!saved) return;
    const res = await fetch(`/api/posts/${saved.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, scheduledAt: scheduled ? new Date(scheduled).toISOString() : null }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json?.error?.message ?? "Status change failed");
      return;
    }
    toast.success(`Status changed to ${next.toLowerCase()}`);
    if (next === "TRASH") {
      router.push("/admin/posts");
      return;
    }
    setStatus(next);
    router.refresh();
  };

  const uploadFeatured = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/media", { method: "POST", body });
    const json = await res.json();
    const created = json?.data?.created?.[0];
    if (!res.ok || !created) {
      toast.error(json?.data?.rejected?.[0]?.reason ?? "Upload failed");
      return;
    }
    update("featuredImage", created.url);
    toast.success("Featured image uploaded");
  };

  const toggleId = (key: "categoryIds" | "tagIds", id: string) => {
    const current = form[key];
    update(key, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const titleSlug = (value: string) => {
    if (!slugTouched) {
      setForm((f) => ({ ...f, title: value, slug: slugify(value) }));
      setDirty(true);
    } else {
      update("title", value);
    }
  };

  const seoTitleLen = (form.seoTitle || form.title).length;
  const seoDescLen = form.seoDescription.length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {hasLocalBackup && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
            <span>An unsaved local draft was found for this post.</span>
            <Button size="sm" variant="outline" onClick={restoreLocal}>Restore</Button>
            <Button size="sm" variant="ghost" onClick={discardLocal}>Discard</Button>
          </div>
        )}
        <Card className="p-5 space-y-4">
          <div>
            <label htmlFor="post-title" className="mb-1 block text-sm font-medium">Title</label>
            <Input id="post-title" value={form.title} onChange={(e) => titleSlug(e.target.value)} placeholder="Post title" className="h-12 text-lg font-semibold" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Slug" hint="Used in the URL. Changing a published slug creates a redirect.">
              <Input value={form.slug} onChange={(e) => { setSlugTouched(true); update("slug", slugify(e.target.value)); }} />
            </Field>
            <Field label="Subtitle">
              <Input value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} />
            </Field>
          </div>
          <Field label="Excerpt" hint={`${form.excerpt.length}/500`}>
            <Textarea rows={2} value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} maxLength={500} />
          </Field>
          <RichTextEditor
            initialContent={form.content}
            onChange={(json) => update("content", json)}
            onUploadRequest={() => fileRef.current?.click()}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Search engine listing</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`SEO title (${seoTitleLen}/70)`}>
              <Input value={form.seoTitle} maxLength={70} onChange={(e) => update("seoTitle", e.target.value)} placeholder={form.title} />
            </Field>
            <Field label="Focus keyword">
              <Input value={form.focusKeyword} onChange={(e) => update("focusKeyword", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label={`Meta description (${seoDescLen}/170)`}>
                <Textarea rows={2} maxLength={170} value={form.seoDescription} onChange={(e) => update("seoDescription", e.target.value)} />
              </Field>
            </div>
            <Field label="Canonical URL">
              <Input value={form.canonicalUrl} onChange={(e) => update("canonicalUrl", e.target.value)} placeholder="https://" />
            </Field>
            <div className="flex flex-col gap-2 pt-6 text-sm">
              <Check checked={form.robotsIndex} onChange={(v) => update("robotsIndex", v)} label="Allow search engines to index" />
              <Check checked={form.robotsFollow} onChange={(v) => update("robotsFollow", v)} label="Allow search engines to follow links" />
            </div>
          </div>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Publish</h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-slate-500">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : postId ? "All changes saved" : "Not saved yet"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />Save</Button>
            {postId && status === "PUBLISHED" && (
              <Button variant="outline" onClick={() => window.open(`/blog/${form.slug}`, "_blank")}><Eye className="h-4 w-4" />View</Button>
            )}
          </div>
          <div className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => void changeStatus("DRAFT")}>Save as draft</Button>
            <Button className="w-full" variant="outline" onClick={() => void changeStatus("PENDING")}><Send className="h-4 w-4" />Submit for review</Button>
            {canPublish && (
              <Button className="w-full" onClick={() => void changeStatus("PUBLISHED")}><Globe className="h-4 w-4" />Publish now</Button>
            )}
            {canPublish && (
              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <label htmlFor="schedule" className="mb-1 block text-xs font-medium">Schedule for</label>
                <Input id="schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <Button className="mt-2 w-full" variant="secondary" disabled={!scheduleAt} onClick={() => void changeStatus("SCHEDULED", scheduleAt)}>
                  <Clock className="h-4 w-4" />Schedule
                </Button>
              </div>
            )}
            <Button className="w-full" variant="ghost" onClick={() => void changeStatus("PRIVATE")}><EyeOff className="h-4 w-4" />Make private</Button>
            {postId && (
              <Button className="w-full" variant="danger" onClick={() => void changeStatus("TRASH")}><Trash2 className="h-4 w-4" />Move to trash</Button>
            )}
          </div>
          <Check checked={form.allowComments} onChange={(v) => update("allowComments", v)} label="Allow comments" />
          {canEditAny && authors.length > 0 && (
            <Field label="Author">
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={form.authorId} onChange={(e) => update("authorId", e.target.value)}>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Featured image</h2>
          {form.featuredImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.featuredImage} alt="" className="aspect-video w-full rounded-md object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500 dark:bg-slate-800">No image</div>
          )}
          <Input value={form.featuredImage} onChange={(e) => update("featuredImage", e.target.value)} placeholder="Image URL" aria-label="Featured image URL" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload</Button>
            {form.featuredImage && <Button variant="ghost" size="sm" onClick={() => update("featuredImage", "")}>Remove</Button>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFeatured(f); e.target.value = ""; }}
          />
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Categories</h2>
          <CheckList options={categories} selected={form.categoryIds} onToggle={(id) => toggleId("categoryIds", id)} empty="No categories yet. Create one under Categories." />
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Tags</h2>
          <CheckList options={tags} selected={form.tagIds} onToggle={(id) => toggleId("tagIds", id)} empty="No tags yet. Create one under Tags." />
        </Card>

        {postId && (
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Revisions</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowRevisions((v) => !v)}><History className="h-4 w-4" />{showRevisions ? "Hide" : "Show"}</Button>
            </div>
            {showRevisions && <RevisionsList postId={postId} onRestored={() => window.location.reload()} />}
          </Card>
        )}
      </aside>
    </div>
  );
}

function RevisionsList({ postId, onRestored }: { postId: string; onRestored: () => void }) {
  const [items, setItems] = useState<{ revisionNo: number; title: string; createdAt: string; updatedBy: { displayName: string } | null }[] | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/revisions`)
      .then((r) => r.json())
      .then((j) => setItems(j.data ?? []))
      .catch(() => setItems([]));
  }, [postId]);

  const restore = async (revisionNo: number) => {
    if (!window.confirm(`Restore revision ${revisionNo}? The current version is kept as a new revision.`)) return;
    const res = await fetch(`/api/posts/${postId}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionNo }),
    });
    if (res.ok) {
      toast.success(`Revision ${revisionNo} restored`);
      onRestored();
    } else {
      toast.error("Could not restore revision");
    }
  };

  if (items === null) return <p className="text-sm text-slate-500">Loading…</p>;
  if (items.length === 0) return <p className="text-sm text-slate-500">No earlier revisions yet.</p>;
  return (
    <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
      {items.map((r) => (
        <li key={r.revisionNo} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">Revision {r.revisionNo}</p>
            <p className="text-xs text-slate-500">{formatDate(r.createdAt, "MMM d, HH:mm")} · {r.updatedBy?.displayName ?? "Unknown"}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void restore(r.revisionNo)} aria-label={`Restore revision ${r.revisionNo}`}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
      {label}
    </label>
  );
}

function CheckList({ options, selected, onToggle, empty }: { options: Option[]; selected: string[]; onToggle: (id: string) => void; empty: string }) {
  if (options.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="max-h-48 space-y-1.5 overflow-y-auto">
      {options.map((o) => (
        <li key={o.id}>
          <Check checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} label={o.name} />
        </li>
      ))}
    </ul>
  );
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
