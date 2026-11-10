"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LifeBuoy, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Ticket = { id: string; subject: string; message: string; status: string; priority: string; createdAt: string };

const statusTone: Record<string, string> = {
  OPEN: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  IN_PROGRESS: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RESOLVED: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CLOSED: "border-line bg-surface-2 text-muted",
};

export function StoreSupport({ businessId }: { businessId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTickets(data.tickets || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [businessId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to send");
      setSubject(""); setMessage("");
      setMsg({ tone: "ok", text: "Message sent to admin. You can track status here." });
      await load();
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to send" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Support</h1>
          <p className="mt-1 text-sm text-muted">Send a query or message to the admin. Admin will see it and respond/update status.</p>
        </div>
        <button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Send className="h-4 w-4 text-accent" /> New message / query</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm"><span className="mb-1 block font-medium text-foreground">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="e.g. POS receipt not printing" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
          </label>
          <label className="block text-sm"><span className="mb-1 block font-medium text-foreground">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} placeholder="Describe your issue or question…" className="focus-ring w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground" />
          </label>
          {msg ? <div className={cn("rounded-lg border px-3 py-2 text-sm", msg.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{msg.text}</div> : null}
          <button type="submit" disabled={busy} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Send to admin
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><LifeBuoy className="h-4 w-4 text-accent" /> Your tickets</h2>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-muted">Loading…</p> : tickets.length === 0 ? <p className="text-sm text-muted">No messages yet.</p> : tickets.map((t) => (
            <div key={t.id} className="rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{t.subject}</p>
                <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", statusTone[t.status] || "border-line bg-surface-2 text-muted")}>{t.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{t.message}</p>
              <p className="mt-2 text-xs text-muted">{new Date(t.createdAt).toLocaleString("en-PK")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
