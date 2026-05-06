"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@/lib/types";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/interview/${id}`)
      .then((r) => r.json())
      .then((s) => (s.error ? setError(s.error) : setSession(s)))
      .catch(() => setError("Could not load report"));
  }, [id]);

  if (error)
    return (
      <Centered>
        <p className="text-danger">{error}</p>
      </Centered>
    );

  if (!session || !session.finalReport)
    return (
      <Centered>
        <p className="text-muted-foreground">Loading report…</p>
      </Centered>
    );

  const { finalReport, turns, config } = session;
  const color =
    finalReport.overallScore >= 8
      ? "text-success"
      : finalReport.overallScore >= 5
        ? "text-warning"
        : "text-danger";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm text-muted-foreground">Session report</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {config.role} · {labelType(config.type)}
      </h1>

      <div className="mt-8 rounded-2xl border border-border/60 bg-muted/30 p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Overall score
          </p>
          <p className={`text-5xl font-semibold ${color}`}>
            {finalReport.overallScore.toFixed(1)}
            <span className="text-base text-muted-foreground"> / 10</span>
          </p>
        </div>
        <p className="mt-4 text-sm leading-relaxed">{finalReport.summary}</p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Section title="Top strengths" tone="success" items={finalReport.topStrengths} />
        <Section
          title="Focus areas"
          tone="warning"
          items={finalReport.topImprovements}
        />
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Question-by-question</h2>
      <div className="mt-4 space-y-4">
        {turns.map((t) => (
          <details
            key={t.index}
            className="rounded-xl border border-border/60 bg-muted/30 p-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-sm">
                <span className="text-muted-foreground">Q{t.index + 1}.</span>{" "}
                {t.question}
              </span>
              {t.feedback && (
                <span
                  className={`shrink-0 text-sm font-medium ${
                    t.feedback.score >= 8
                      ? "text-success"
                      : t.feedback.score >= 5
                        ? "text-warning"
                        : "text-danger"
                  }`}
                >
                  {t.feedback.score.toFixed(1)}/10
                </span>
              )}
            </summary>
            {t.answer && (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.answer}</p>
                </div>
                {t.feedback && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Feedback
                    </p>
                    <p className="mt-1 leading-relaxed">{t.feedback.summary}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Bullets items={t.feedback.strengths} tone="success" />
                      <Bullets items={t.feedback.improvements} tone="warning" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </details>
        ))}
      </div>

      <div className="mt-12 flex gap-3">
        <Link
          href="/setup"
          className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Run another session
        </Link>
        <Link
          href="/"
          className="rounded-md border border-border px-5 py-3 text-sm transition hover:bg-muted"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "success" | "warning";
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <Bullets items={items} tone={tone} />
    </div>
  );
}

function Bullets({
  items,
  tone,
}: {
  items: string[];
  tone: "success" | "warning";
}) {
  if (items.length === 0)
    return <p className="mt-2 text-sm text-muted-foreground">—</p>;
  const dot = tone === "success" ? "bg-success" : "bg-warning";
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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
