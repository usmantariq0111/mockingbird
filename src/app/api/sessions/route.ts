import { NextResponse } from "next/server";
import { sessions } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const list = sessions.list().map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    finished: s.finished,
    role: s.config.role,
    company: s.config.company,
    type: s.config.type,
    difficulty: s.config.difficulty,
    questionCount: s.config.questionCount,
    answeredCount: s.turns.filter((t) => t.answer).length,
    overallScore: s.finalReport?.overallScore ?? null,
  }));
  return NextResponse.json({ sessions: list });
}
