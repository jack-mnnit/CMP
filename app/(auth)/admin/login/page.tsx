import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Sign in" };

// Lives outside app/admin so the admin layout's auth redirect cannot loop back onto itself.
// The signed-in redirect is handled by proxy.ts.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">BlogMaster CMS</h1>
          <p className="mt-1 text-sm text-slate-500">Manage Your Content. Grow Your Audience.</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
