import { BookOpen } from "lucide-react";

export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-slate-800">
        <BookOpen className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <p className="mt-4 text-xs text-slate-400">This module is not built yet.</p>
    </div>
  );
}
