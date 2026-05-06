"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Feedback, Session } from "@/lib/types";

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/interview/${id}`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (s.error) setError(s.error);
        else setSession(s);
      })
      .catch(() => setError("Could not load session"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <Centered>
        <p className="text-danger">{error}</p>
        <Link href="/setup" className="mt-4 text-sm underline">
          Start a new session
        </Link>
      </Centered>
    );

  if (!session)
    return (
      <Centered>
        <p className="text-muted-foreground">Loading…</p>
      </Centered>
    );

  const current = session.turns[session.turns.length - 1];
  const totalAnswered = session.turns.filter((t) => t.answer).length;

  async function submit() {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: draft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setLatestFeedback(json.feedback);
      setDraft("");

      const refreshed = await fetch(`/api/interview/${id}`).then((r) => r.json());
      setSession(refreshed);

      if (json.finished) {
        setTimeout(() => router.push(`/report/${id}`), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function skip() {
    setDraft("(I would like to skip this question)");
    setTimeout(submit, 0);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <span className="text-foreground font-medium">{session.config.role}</span>{" "}
          · {labelType(session.config.type)} · {labelDifficulty(session.config.difficulty)}
        </div>
        <div>
          Question{" "}
          <span className="text-foreground">
            {Math.min(totalAnswered + 1, session.config.questionCount)}
          </span>{" "}
          / {session.config.questionCount}
        </div>
      </div>

      <ProgressBar
        value={totalAnswered}
        max={session.config.questionCount}
      />

      <div className="rounded-2xl border border-border/60 bg-muted/30 p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Interviewer
        </p>
        <p className="mt-2 text-lg leading-relaxed">
          {current?.question}
        </p>
      </div>

      {latestFeedback && (
        <FeedbackCard feedback={latestFeedback} />
      )}

      {!session.finished && (
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            placeholder="Type your answer. Use as much detail as you would in a real interview."
            rows={6}
            className="min-h-[160px] w-full rounded-xl border border-border bg-muted/40 p-4 text-sm outline-none transition focus:border-accent focus:bg-muted/60 disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="flex items-center justify-between">
            <button
              onClick={skip}
              disabled={submitting}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Skip question
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">⌘ + Enter to submit</span>
              <button
                onClick={submit}
                disabled={submitting || !draft.trim()}
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Evaluating…" : "Submit answer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {session.finished && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Generating your final report…</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const color =
    feedback.score >= 8
      ? "text-success"
      : feedback.score >= 5
        ? "text-warning"
        : "text-danger";
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Feedback on previous answer
        </p>
        <p className={`text-2xl font-semibold ${color}`}>
          {feedback.score.toFixed(1)}
          <span className="text-sm text-muted-foreground"> / 10</span>
        </p>
      </div>
      <p className="mt-3 text-sm">{feedback.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FeedbackList title="Strengths" items={feedback.strengths} tone="success" />
        <FeedbackList title="Improvements" items={feedback.improvements} tone="warning" />
      </div>
      {feedback.starCoverage && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">STAR coverage:</span>
          {(["situation", "task", "action", "result"] as const).map((k) => (
            <span
              key={k}
              className={`rounded-md border px-2 py-0.5 text-xs ${
                feedback.starCoverage?.[k]
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {k}
            </span>
          ))}
        </div>
      )}
      {typeof feedback.fillerWordCount === "number" && feedback.fillerWordCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Filler words detected: {feedback.fillerWordCount}
        </p>
      )}
    </div>
  );
}

function FeedbackList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  if (items.length === 0) return null;
  const dot = tone === "success" ? "bg-success" : "bg-warning";
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-accent transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {children}
    </div>
  );
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
