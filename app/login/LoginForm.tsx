"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login") || next.startsWith("/signup")) return null;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; role?: string; tenantId?: string | null; redirectTo?: string };
      if (!res.ok) throw new Error(data.message || "Login failed.");
      const isAdmin = data.role === "SUPER_ADMIN" || data.role === "SUB_ADMIN";
      const dest = isAdmin ? (safeNext(search.get("next")) || data.redirectTo || "/") : (data.redirectTo || "/");
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-panel sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">OmniPos Hub</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} autoComplete="off" className="space-y-4">
          {/* Hidden decoys reduce browser autofill */}
          <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" readOnly />
          <input type="password" name="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" readOnly />
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input id="email" name="omnipos_login_email" type="email" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted" placeholder="Email" />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input id="password" name="omnipos_login_secret" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted" placeholder="Password" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {loading ? "Signing in…" : "Sign in"}
            {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">Secure sign-in. Contact the administrator if you need access.</p>
      </div>
    </div>
  );
}
