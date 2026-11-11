import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getSession, isPlatformAdmin } from "@/lib/auth/server";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your shop account",
  description: "Start a 7-day free trial for your shop — POS, inventory, invoices and industry features.",
};

export default async function SignupPage() {
  const session = await getSession().catch(() => null);
  if (session) {
    if (isPlatformAdmin(session.role)) redirect("/dashboard");
    if (session.tenantId) redirect(`/store/${session.tenantId}`);
  }

  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
