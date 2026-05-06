import OpenAI from "openai";
import { z } from "zod";
import type {
  Difficulty,
  Feedback,
  FinalReport,
  InterviewConfig,
  InterviewType,
  Turn,
} from "./types";

let _client: OpenAI | null = null;
function client() {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const TYPE_LABEL: Record<InterviewType, string> = {
  behavioral: "behavioral interview (STAR-style stories about past experience)",
  technical: "technical knowledge interview (concepts, trade-offs, debugging)",
  system_design: "system design interview (architecture, scaling, trade-offs)",
  coding: "coding interview (problem-solving, complexity, edge cases)",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  junior: "early-career (0-2 years)",
  mid: "mid-level (2-5 years)",
  senior: "senior (5-10 years)",
  staff: "staff/principal (10+ years)",
};

function systemPrompt(config: InterviewConfig) {
  return `You are an experienced ${config.role} interviewer at ${config.company || "a top tech company"}.
You are conducting a ${TYPE_LABEL[config.type]} for a ${DIFFICULTY_LABEL[config.difficulty]} candidate.

Style:
- Ask one focused question at a time. No preamble, no "Great question!" filler.
- Keep questions concise (1-3 sentences). For coding/system design, you may include a short scenario.
- Build on the candidate's resume and the job description when possible.
- Vary question types: don't repeat patterns. Probe weak spots in their resume.
- For behavioral: ask STAR-friendly questions ("Tell me about a time when…").

Candidate resume:
"""
${config.resumeText?.slice(0, 6000) || "(no resume provided)"}
"""

Job description:
"""
${config.jobDescription?.slice(0, 4000) || "(no job description provided)"}
"""`;
}

const NextQuestionSchema = z.object({
  question: z.string().min(8),
  rationale: z.string().optional(),
});

export async function generateNextQuestion(
  config: InterviewConfig,
  priorTurns: Turn[],
): Promise<string> {
  const history = priorTurns
    .map((t) => `Q${t.index + 1}: ${t.question}\nA${t.index + 1}: ${t.answer ?? "(skipped)"}`)
    .join("\n\n");

  const userPrompt =
    priorTurns.length === 0
      ? "Ask the FIRST interview question now. Make it a strong opener appropriate for the interview type."
      : `Conversation so far:\n\n${history}\n\nNow ask question #${priorTurns.length + 1} of ${config.questionCount}. Pick a topic you have NOT yet explored.`;

  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "next_question",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["question", "rationale"],
        },
      },
    },
    messages: [
      { role: "system", content: systemPrompt(config) },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = NextQuestionSchema.parse(JSON.parse(raw));
  return parsed.question.trim();
}

const FeedbackSchema = z.object({
  score: z.number().min(0).max(10),
  strengths: z.array(z.string()).max(5),
  improvements: z.array(z.string()).max(5),
  starCoverage: z
    .object({
      situation: z.boolean(),
      task: z.boolean(),
      action: z.boolean(),
      result: z.boolean(),
    })
    .optional(),
  fillerWordCount: z.number().int().nonnegative().optional(),
  summary: z.string(),
});

export async function evaluateAnswer(
  config: InterviewConfig,
  question: string,
  answer: string,
): Promise<Feedback> {
  const isBehavioral = config.type === "behavioral";

  const schemaProperties: Record<string, unknown> = {
    score: { type: "number", minimum: 0, maximum: 10 },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    improvements: { type: "array", items: { type: "string" }, maxItems: 5 },
    fillerWordCount: { type: "integer", minimum: 0 },
    summary: { type: "string" },
  };
  const required = ["score", "strengths", "improvements", "fillerWordCount", "summary"];

  if (isBehavioral) {
    schemaProperties.starCoverage = {
      type: "object",
      additionalProperties: false,
      properties: {
        situation: { type: "boolean" },
        task: { type: "boolean" },
        action: { type: "boolean" },
        result: { type: "boolean" },
      },
      required: ["situation", "task", "action", "result"],
    };
    required.push("starCoverage");
  }

  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "answer_feedback",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: schemaProperties,
          required,
        },
      },
    },
    messages: [
      {
        role: "system",
        content: `You are a tough but fair interview coach evaluating an answer.
Be specific, cite concrete things the candidate said, and give actionable feedback.
Score 0-10 where 5 is "average hire-bar answer", 8+ is "strong hire", 3- is "would not pass".
${isBehavioral ? "Evaluate STAR coverage (Situation, Task, Action, Result)." : ""}
Count obvious filler words: "um", "uh", "like", "you know", "basically", "literally", "sort of".
Keep "summary" to 1-2 sentences. Strengths/improvements: 1-3 bullets each, each 1 sentence max.`,
      },
      {
        role: "user",
        content: `Interview type: ${config.type}
Role: ${config.role}
Difficulty: ${config.difficulty}

Question: ${question}

Candidate's answer:
"""
${answer}
"""`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  return FeedbackSchema.parse(JSON.parse(raw));
}

export async function generateFinalReport(
  config: InterviewConfig,
  turns: Turn[],
): Promise<FinalReport> {
  const completed = turns.filter((t) => t.feedback);
  const avg =
    completed.length === 0
      ? 0
      : completed.reduce((s, t) => s + (t.feedback?.score ?? 0), 0) / completed.length;

  const transcript = turns
    .map(
      (t) =>
        `--- Turn ${t.index + 1} ---\nQ: ${t.question}\nA: ${t.answer ?? "(skipped)"}\nScore: ${t.feedback?.score ?? "-"}\nNotes: ${t.feedback?.summary ?? "-"}`,
    )
    .join("\n\n");

  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "final_report",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            topStrengths: { type: "array", items: { type: "string" }, maxItems: 5 },
            topImprovements: { type: "array", items: { type: "string" }, maxItems: 5 },
            summary: { type: "string" },
          },
          required: ["topStrengths", "topImprovements", "summary"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content: `You are an interview coach producing a final report after a mock ${config.type} interview for a ${config.role} role.
Synthesize patterns ACROSS the whole session, not per-question. Be specific and actionable.
Summary: 2-3 sentences. Strengths/improvements: up to 4 bullets each, 1 sentence each.`,
      },
      {
        role: "user",
        content: `Average score: ${avg.toFixed(1)}/10\n\nFull session:\n\n${transcript}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = z
    .object({
      topStrengths: z.array(z.string()),
      topImprovements: z.array(z.string()),
      summary: z.string(),
    })
    .parse(JSON.parse(raw));

  return {
    overallScore: Math.round(avg * 10) / 10,
    ...parsed,
  };
}
