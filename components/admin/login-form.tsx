"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { loginSchema } from "@/lib/validations";
import { Button, Input, Spinner } from "@/components/ui";
import { z } from "zod";

type FormValues = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema), defaultValues: { remember: false } });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setServerError(json?.error?.message ?? "Login failed");
      return;
    }
    toast.success("Welcome back");
    const next = params.get("next");
    router.replace(next && next.startsWith("/admin") ? next : "/admin/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {params.get("expired") && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Your session expired. Please sign in again.</p>
      )}
      {serverError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <a href="/admin/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</a>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-900"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("remember")} />
        Remember me for 30 days
      </label>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : <Lock className="h-4 w-4" />}
        Sign in
      </Button>
    </form>
  );
}
