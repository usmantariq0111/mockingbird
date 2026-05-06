"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import type { Feedback, Session } from "@/lib/types";
import { parsePartialJson } from "@/lib/partial-json";
import { readSse } from "@/lib/sse";
import {
  cancelSpeak,
  createRecognition,
  isSttSupported,
  isTtsSupported,
  pickInterviewerVoice,
  speak,
  type SpeechRecognitionLike,
} from "@/lib/voice";

type StreamState = "idle" | "evaluating" | "advancing";

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVoice = searchParams.get("voice") === "1";

  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState("");
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [partialFeedback, setPartialFeedback] = useState<Partial<Feedback> | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<Feedback | null>(null);

  const [voiceMode, setVoiceMode] = useState(initialVoice);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenQuestionRef = useRef<string | null>(null);
  const interimTranscriptRef = useRef("");
  const sttSupported = useMemo(() => isSttSupported(), []);
  const ttsSupported = useMemo(() => isTtsSupported(), []);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Load session on mount + warm voices.
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

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // getVoices is async-ish; bump it.
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        voiceRef.current = pickInterviewerVoice();
      };
      voiceRef.current = pickInterviewerVoice();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = session?.turns[session.turns.length - 1];
  const totalAnswered = session?.turns.filter((t) => t.answer).length ?? 0;

  // Speak the current question whenever it changes (and voice mode is on).
  useEffect(() => {
    if (!session || !current || !voiceMode || !ttsSupported) return;
    if (current.answer !== undefined) return;
    if (lastSpokenQuestionRef.current === current.question) return;
    lastSpokenQuestionRef.current = current.question;

    setSpeaking(true);
    speak(current.question, { voice: voiceRef.current })
      .catch(() => {})
      .finally(() => {
        setSpeaking(false);
        if (voiceMode && sttSupported) startListening();
      });
    return () => {
      cancelSpeak();
      setSpeaking(false);
    };
  }, [session, current, voiceMode, ttsSupported, sttSupported]);

  const startListening = useCallback(() => {
    if (!sttSupported) return;
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* noop */
      }
    }
    const rec = createRecognition();
    if (!rec) return;
    interimTranscriptRef.current = "";

    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      if (finalText) interimTranscriptRef.current += finalText;
      setDraft((interimTranscriptRef.current + interim).trim());
    };
    rec.onerror = (ev) => {
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        setError(`Mic: ${ev.error}`);
      }
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
      recRef.current = rec;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start mic");
    }
  }, [sttSupported]);

  const stopListening = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  // Streaming submit
  const submit = useCallback(async () => {
    if (!session || !draft.trim() || streamState !== "idle") return;
    stopListening();
    cancelSpeak();
    setError(null);
    setStreamState("evaluating");
    setPartialFeedback(null);
    setLatestFeedback(null);

    const answerText = draft.trim();
    setDraft("");

    try {
      const res = await fetch(`/api/interview/${id}/answer/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Stream error ${res.status}`);
      }

      let finishedSession = false;

      for await (const evt of readSse(res)) {
        if (evt.event === "feedback-delta") {
          const data = evt.data as { buffer: string };
          const partial = parsePartialJson<Partial<Feedback>>(data.buffer);
          if (partial) setPartialFeedback(partial);
        } else if (evt.event === "feedback-complete") {
          const data = evt.data as { feedback: Feedback };
          setLatestFeedback(data.feedback);
          setPartialFeedback(null);
        } else if (evt.event === "next-question") {
          setStreamState("advancing");
          const refreshed = await fetch(`/api/interview/${id}`).then((r) => r.json());
          setSession(refreshed);
          if (voiceMode && ttsSupported) {
            // useEffect on `current` change will speak it.
          }
        } else if (evt.event === "final-report") {
          finishedSession = true;
          const refreshed = await fetch(`/api/interview/${id}`).then((r) => r.json());
          setSession(refreshed);
        } else if (evt.event === "error") {
          const data = evt.data as { error: string };
          throw new Error(data.error);
        } else if (evt.event === "done") {
          // handled below
        }
      }

      setStreamState("idle");
      if (finishedSession) {
        setTimeout(() => router.push(`/report/${id}`), 1800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setStreamState("idle");
    }
  }, [session, draft, streamState, stopListening, id, router, voiceMode, ttsSupported]);

  function skip() {
    setDraft("(I would like to skip this question)");
    setTimeout(submit, 0);
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      cancelSpeak();
      stopListening();
      setVoiceMode(false);
    } else {
      setVoiceMode(true);
      lastSpokenQuestionRef.current = null; // re-speak current question
    }
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopListening();
      cancelSpeak();
    };
  }, [stopListening]);

  if (error && !session)
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

  const showFeedback = latestFeedback || partialFeedback;
  const isStreaming = streamState !== "idle";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <span className="text-foreground font-medium">{session.config.role}</span>{" "}
          · {labelType(session.config.type)} ·{" "}
          {labelDifficulty(session.config.difficulty)}
        </div>
        <div className="flex items-center gap-3">
          {(ttsSupported || sttSupported) && (
            <button
              onClick={toggleVoiceMode}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
                voiceMode
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title={voiceMode ? "Switch to text mode" : "Switch to voice mode"}
            >
              {voiceMode ? <Volume2 size={12} /> : <VolumeX size={12} />}
              Voice
            </button>
          )}
          <span>
            Question{" "}
            <span className="text-foreground">
              {Math.min(totalAnswered + 1, session.config.questionCount)}
            </span>{" "}
            / {session.config.questionCount}
          </span>
        </div>
      </div>

      <ProgressBar value={totalAnswered} max={session.config.questionCount} />

      <div className="rounded-2xl border border-border/60 bg-muted/30 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Interviewer
          </p>
          {speaking && (
            <span className="flex items-center gap-1.5 text-xs text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-accent" />
              </span>
              Speaking
            </span>
          )}
        </div>
        <p className="mt-2 text-lg leading-relaxed">{current?.question}</p>
      </div>

      {showFeedback && (
        <FeedbackCard
          feedback={showFeedback}
          streaming={!latestFeedback}
        />
      )}

      {!session.finished && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isStreaming}
              placeholder={
                voiceMode
                  ? "Speak your answer… (or type if you prefer)"
                  : "Type your answer. Use as much detail as you would in a real interview."
              }
              rows={6}
              className="min-h-[160px] w-full rounded-xl border border-border bg-muted/40 p-4 text-sm outline-none transition focus:border-accent focus:bg-muted/60 disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
            {voiceMode && (
              <button
                onClick={listening ? stopListening : startListening}
                disabled={isStreaming || !sttSupported}
                className={`absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                  listening
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                title={listening ? "Stop listening" : "Start listening"}
              >
                {listening ? <MicOff size={12} /> : <Mic size={12} />}
                {listening ? "Listening…" : "Mic"}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={skip}
              disabled={isStreaming}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Skip question
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">⌘ + Enter to submit</span>
              <button
                onClick={submit}
                disabled={isStreaming || !draft.trim()}
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {streamState === "evaluating"
                  ? "Evaluating…"
                  : streamState === "advancing"
                    ? "Next question…"
                    : "Submit answer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {session.finished && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Heading to your report…</p>
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

function FeedbackCard({
  feedback,
  streaming,
}: {
  feedback: Partial<Feedback>;
  streaming: boolean;
}) {
  const score = typeof feedback.score === "number" ? feedback.score : null;
  const color =
    score == null
      ? "text-muted-foreground"
      : score >= 8
        ? "text-success"
        : score >= 5
          ? "text-warning"
          : "text-danger";

  return (
    <div className="rounded-2xl border border-border/60 bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {streaming && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
          )}
          Feedback {streaming ? "(streaming…)" : "on previous answer"}
        </p>
        {score != null && (
          <p className={`text-2xl font-semibold ${color}`}>
            {score.toFixed(1)}
            <span className="text-sm text-muted-foreground"> / 10</span>
          </p>
        )}
      </div>
      {feedback.summary && (
        <p className="mt-3 text-sm">{feedback.summary}</p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FeedbackList title="Strengths" items={feedback.strengths || []} tone="success" />
        <FeedbackList
          title="Improvements"
          items={feedback.improvements || []}
          tone="warning"
        />
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
