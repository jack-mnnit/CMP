"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

interface Props {
  id: string;
  inTrash: boolean;
  canDelete: boolean;
}

export function PostRowActions({ id, inTrash, canDelete }: Props) {
  const router = useRouter();

  const call = async (label: string, request: Promise<Response>) => {
    const res = await request;
    if (res.ok) {
      toast.success(label);
      router.refresh();
    } else {
      const json = await res.json().catch(() => null);
      toast.error(json?.error?.message ?? "Action failed");
    }
  };

  if (inTrash) {
    return (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" aria-label="Restore post" onClick={() => call("Post restored", fetch(`/api/posts/${id}/status`, { method: "PUT" }))}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete permanently"
            onClick={() => {
              if (window.confirm("Delete this post permanently? This cannot be undone.")) {
                void call("Post deleted", fetch(`/api/posts/${id}?permanent=true`, { method: "DELETE" }));
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Link href={`/admin/posts/${id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Edit post">
        <Pencil className="h-4 w-4" />
      </Link>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Move to trash"
        onClick={() => {
          if (window.confirm("Move this post to the trash?")) {
            void call("Moved to trash", fetch(`/api/posts/${id}`, { method: "DELETE" }));
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
