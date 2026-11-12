"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login") || next.startsWith("/signup")) return null;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [platformName, setPlatformName] = useState("MNI POS");
  const [platformLogo, setPlatformLogo] = useState<string | null>("/logo.png");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/platform/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { platformName?: string; platformLogoDataUrl?: string | null };
        if (cancelled) return;
        if (data.platformName) setPlatformName(data.platformName);
        setPlatformLogo(data.platformLogoDataUrl ?? "/logo.png");
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "LOGIN", email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; upgrade?: boolean; code?: string };
      if (!res.ok) throw new Error(data.message || "Could not send verification code.");
      setStep("otp");
      setInfo(data.message || "Verification code sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "LOGIN", email, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; role?: string; tenantId?: string | null; redirectTo?: string; upgrade?: boolean };
      if (!res.ok) throw new Error(data.message || "Login failed.");
      const isAdmin = data.role === "SUPER_ADMIN" || data.role === "SUB_ADMIN";
      const dest = isAdmin ? (safeNext(search.get("next")) || data.redirectTo || "/dashboard") : (data.redirectTo || "/");
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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-1">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platformLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{platformName}</h1>
          <p className="mt-1 text-sm text-muted">{step === "otp" ? "Enter the verification code sent to your email" : "Sign in to your account"}</p>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
            {info}
          </div>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={sendOtp} autoComplete="off" className="space-y-4">
            <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" readOnly />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" readOnly />
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id="email" name="omnipos_login_email" type="email" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted" placeholder="you@example.com" />
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
              {loading ? "Sending code…" : "Continue"}
              {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
              Code sent to <span className="font-medium text-foreground">{email}</span>
            </div>
            <div>
              <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-foreground">Verification code</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id="otp" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:text-muted" placeholder="6-digit code" />
              </div>
            </div>
            <button type="submit" disabled={loading || code.length !== 6} className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => { setStep("credentials"); setCode(""); setError(""); setInfo(""); }} className="font-medium text-muted hover:text-foreground">Back</button>
              <button type="button" onClick={sendOtp as any} disabled={loading} className="font-medium text-accent hover:underline disabled:opacity-50">Resend code</button>
            </div>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted">
          Don&apos;t have an account? <Link href="/signup" className="font-medium text-accent hover:underline">Start your free trial</Link>
        </p>
      </div>
    </div>
  );
}
