"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LifeBuoy, Megaphone, Plus, RefreshCw, Send } from "lucide-react";

type Ticket = { id: string; subject: string; message: string; status: string; priority: string; requester?: string | null; email?: string | null; createdAt: string; tenant?: { businessName: string } | null };
type Announcement = { id: string; title: string; body: string; audience: string; publishedAt?: string | null; createdAt: string };

const pill: Record<string, string> = {
  OPEN: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  IN_PROGRESS: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RESOLVED: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CLOSED: "border-line bg-surface-2 text-muted",
  URGENT: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  HIGH: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, a] = await Promise.all([
        fetch("/api/support/tickets", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/support/announcements", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setTickets(t.tickets || []);
      setAnnouncements(a.announcements || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) });
      if (res.ok) { setSubject(""); setMessage(""); await load(); }
    } finally { setBusy(false); }
  };

  const updateTicket = async (id: string, status: string) => {
    await fetch("/api/support/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  };

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, audience: "all", publish: true }) });
      if (res.ok) { setTitle(""); setBody(""); await load(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Support &amp; Tickets</h1>
          <p className="mt-1 text-sm text-muted">Shopkeeper complaints/queries and broadcast announcements to all businesses.</p>
        </div>
        <button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><LifeBuoy className="h-4 w-4 text-accent" /> Help / support tickets</h2>
          <p className="mt-0.5 text-sm text-muted">e.g. receipt printing issues, password reset requests.</p>
          <form onSubmit={createTicket} className="mt-4 space-y-2 rounded-lg border border-line bg-surface-2/30 p-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. POS receipt not printing)" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Details…" rows={3} className="focus-ring w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground" />
            <button type="submit" disabled={busy} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"><Plus className="h-4 w-4" /> Create ticket</button>
          </form>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-muted">Loading…</p> : tickets.length === 0 ? <p className="text-sm text-muted">No tickets yet.</p> : tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-surface-2/30 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-semibold text-foreground">{t.subject}</p><p className="mt-0.5 text-xs text-muted">{t.tenant?.businessName ? `${t.tenant.businessName} · ` : ""}{t.requester || "Requester"} · {new Date(t.createdAt).toLocaleString("en-PK")}</p></div>
                  <div className="flex gap-1.5"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${pill[t.status] ?? "border-line bg-surface-2 text-muted"}`}>{t.status}</span><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${pill[t.priority] ?? "border-line bg-surface-2 text-muted"}`}>{t.priority}</span></div>
                </div>
                <p className="mt-2 text-sm text-muted">{t.message}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                    <button key={s} type="button" onClick={() => void updateTicket(t.id, s)} className={`focus-ring rounded-md border px-2 py-1 text-xs ${t.status === s ? "border-accent-line bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"}`}>{s}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Megaphone className="h-4 w-4 text-accent" /> Broadcast announcements</h2>
          <p className="mt-0.5 text-sm text-muted">Send a message to all shopkeepers/businesses (e.g. maintenance notice).</p>
          <form onSubmit={publish} className="mt-4 space-y-2 rounded-lg border border-line bg-surface-2/30 p-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. System maintenance tonight)" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Announcement message…" rows={3} className="focus-ring w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground" />
            <button type="submit" disabled={busy} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"><Send className="h-4 w-4" /> Publish to all</button>
          </form>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-muted">Loading…</p> : announcements.length === 0 ? <p className="text-sm text-muted">No announcements yet.</p> : announcements.map((a) => (
              <div key={a.id} className="rounded-lg border border-line bg-surface-2/30 p-3">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-foreground">{a.title}</p><span className="text-xs text-muted">{a.publishedAt ? "Published" : "Draft"}</span></div>
                <p className="mt-1 text-sm text-muted">{a.body}</p>
                <p className="mt-2 text-xs text-muted">Audience: {a.audience} · {new Date(a.createdAt).toLocaleString("en-PK")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
