import { NextResponse } from "next/server";
import { z } from "zod";
import { sessions } from "@/lib/store";
import { evaluateAnswer, generateFinalReport, generateNextQuestion } from "@/lib/llm";

export const runtime = "nodejs";

const BodySchema = z.object({
  answer: z.string().min(1).max(10000),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const session = sessions.get(id);
    if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (session.finished) return NextResponse.json({ error: "already finished" }, { status: 400 });

    const { answer } = BodySchema.parse(await req.json());

    const current = session.turns[session.turns.length - 1];
    if (!current || current.answer !== undefined) {
      return NextResponse.json({ error: "no pending question" }, { status: 400 });
    }
    current.answer = answer;
    current.feedback = await evaluateAnswer(session.config, current.question, answer);

    const isLast = session.turns.length >= session.config.questionCount;
    if (isLast) {
      session.finished = true;
      session.finalReport = await generateFinalReport(session.config, session.turns);
    } else {
      const next = await generateNextQuestion(session.config, session.turns);
      session.turns.push({ index: session.turns.length, question: next });
    }

    sessions.set(session);

    return NextResponse.json({
      feedback: current.feedback,
      finished: session.finished,
      nextQuestion: session.finished ? null : session.turns[session.turns.length - 1].question,
      finalReport: session.finalReport ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit answer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
