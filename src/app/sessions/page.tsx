"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

interface SessionSummary {
  id: string;
  createdAt: number;
  finished: boolean;
  role: string;
  company?: string;
  type: string;
  difficulty: string;
  questionCount: number;
  answeredCount: number;
  overallScore: number | null;
}

export default function SessionsPage() {
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/sessions");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setItems(json.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this session?")) return;
    await fetch(`/api/interview/${id}/delete`, { method: "POST" });
    refresh();
  }

  if (error)
    return (
      <Wrap>
        <p className="text-danger">{error}</p>
      </Wrap>
    );

  if (!items)
    return (
      <Wrap>
        <p className="text-muted-foreground">Loading…</p>
      </Wrap>
    );

  if (items.length === 0)
    return (
      <Wrap>
        <h1 className="text-3xl font-semibold tracking-tight">Past sessions</h1>
        <div className="mt-12 rounded-xl border border-border/60 bg-muted/30 p-12 text-center">
          <p className="text-lg text-muted-foreground">No sessions yet.</p>
          <Link
            href="/setup"
            className="mt-6 inline-block rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Start your first one
          </Link>
        </div>
      </Wrap>
    );

  return (
    <Wrap>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Past sessions</h1>
        <Link
          href="/setup"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          New session
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {items.map((s) => (
          <SessionCard key={s.id} s={s} onDelete={() => handleDelete(s.id)} />
        ))}
      </div>
    </Wrap>
  );
}

function SessionCard({
  s,
  onDelete,
}: {
  s: SessionSummary;
  onDelete: () => void;
}) {
  const linkHref = s.finished ? `/report/${s.id}` : `/interview/${s.id}`;
  const date = new Date(s.createdAt);
  const dateLabel =
    date.toDateString() === new Date().toDateString()
      ? `Today ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const scoreColor =
    s.overallScore == null
      ? "text-muted-foreground"
      : s.overallScore >= 8
        ? "text-success"
        : s.overallScore >= 5
          ? "text-warning"
          : "text-danger";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 transition hover:border-border">
      <Link href={linkHref} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground truncate">{s.role}</span>
          {s.company && (
            <span className="text-muted-foreground">· {s.company}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{labelType(s.type)}</span>
          <span>·</span>
          <span>{labelDifficulty(s.difficulty)}</span>
          <span>·</span>
          <span>
            {s.answeredCount}/{s.questionCount} answered
          </span>
          <span>·</span>
          <span>{dateLabel}</span>
          {!s.finished && (
            <>
              <span>·</span>
              <span className="rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning">
                in progress
              </span>
            </>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-3">
        {s.overallScore != null && (
          <div className={`text-lg font-semibold ${scoreColor}`}>
            {s.overallScore.toFixed(1)}
            <span className="text-xs text-muted-foreground"> /10</span>
          </div>
        )}
        <button
          onClick={onDelete}
          aria-label="Delete session"
          className="rounded-md border border-transparent p-2 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:border-border hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-12">{children}</div>;
}

function labelType(t: string) {
  return (
    {
      behavioral: "Behavioral",
      technical: "Technical",
      system_design: "System design",
      coding: "Coding",
    } as Record<string, string>
  )[t] || t;
}

function labelDifficulty(d: string) {
  return (
    {
      junior: "Junior",
      mid: "Mid",
      senior: "Senior",
      staff: "Staff+",
    } as Record<string, string>
  )[d] || d;
}
