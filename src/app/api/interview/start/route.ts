import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { sessions } from "@/lib/store";
import { generateNextQuestion } from "@/lib/llm";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";

const BodySchema = z.object({
  role: z.string().min(1).max(120),
  company: z.string().max(120).optional(),
  type: z.enum(["behavioral", "technical", "system_design", "coding"]),
  difficulty: z.enum(["junior", "mid", "senior", "staff"]),
  questionCount: z.number().int().min(1).max(20),
  resumeText: z.string().max(20000).optional(),
  jobDescription: z.string().max(10000).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const config = BodySchema.parse(json);

    const session: Session = {
      id: nanoid(10),
      createdAt: Date.now(),
      config,
      turns: [],
      finished: false,
    };

    const firstQuestion = await generateNextQuestion(config, []);
    session.turns.push({ index: 0, question: firstQuestion });
    sessions.set(session);

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start session";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
