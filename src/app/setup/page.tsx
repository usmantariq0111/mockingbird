"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Difficulty, InterviewType } from "@/lib/types";

export default function SetupPage() {
  const router = useRouter();
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("");
  const [type, setType] = useState<InterviewType>("behavioral");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [questionCount, setQuestionCount] = useState(5);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume(file: File) {
    setError(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/resume", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setResumeText(json.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setParsing(false);
    }
  }

  async function start() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          company: company || undefined,
          type,
          difficulty,
          questionCount,
          resumeText: resumeText || undefined,
          jobDescription: jobDescription || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start");
      router.push(`/interview/${json.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Set up your session</h1>
      <p className="mt-2 text-muted-foreground">
        The more context you give, the more relevant your questions will be.
      </p>

      <div className="mt-10 space-y-8">
        <Field label="Role" hint="What job are you interviewing for?">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            className={inputCls}
          />
        </Field>

        <Field label="Company (optional)">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Stripe"
            className={inputCls}
          />
        </Field>

        <Field label="Interview type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["behavioral", "Behavioral"],
                ["technical", "Technical"],
                ["system_design", "System design"],
                ["coding", "Coding"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setType(val)}
                className={pillCls(type === val)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Seniority">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["junior", "Junior"],
                ["mid", "Mid"],
                ["senior", "Senior"],
                ["staff", "Staff+"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDifficulty(val)}
                className={pillCls(difficulty === val)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Number of questions: ${questionCount}`}>
          <input
            type="range"
            min={1}
            max={10}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>

        <Field
          label="Resume"
          hint="Upload a PDF/TXT or paste plain text. Used to ask resume-specific questions."
        >
          <div className="flex flex-col gap-3">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/70">
              <input
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleResume(f);
                }}
              />
              {parsing ? "Parsing…" : "Upload resume (PDF/TXT)"}
            </label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="…or paste your resume text here"
              rows={6}
              className={inputCls + " min-h-[120px] font-mono text-xs"}
            />
            {resumeText && (
              <p className="text-xs text-muted-foreground">
                {resumeText.length.toLocaleString()} characters loaded
              </p>
            )}
          </div>
        </Field>

        <Field label="Job description (optional)">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job posting here"
            rows={6}
            className={inputCls + " min-h-[120px] font-mono text-xs"}
          />
        </Field>

        {error && (
          <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={start}
            disabled={submitting || !role.trim()}
            className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Generating first question…" : "Start interview"}
          </button>
          <span className="text-xs text-muted-foreground">
            First question takes ~2 seconds to generate.
          </span>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition focus:border-accent focus:bg-muted/60";

function pillCls(active: boolean) {
  return [
    "rounded-md border px-3 py-2 text-sm transition",
    active
      ? "border-accent bg-accent/10 text-foreground"
      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
