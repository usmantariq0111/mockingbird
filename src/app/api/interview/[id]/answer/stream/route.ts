import { z } from "zod";
import { sessions } from "@/lib/store";
import {
  evaluateAnswerStream,
  generateFinalReport,
  generateNextQuestion,
  parseFeedback,
} from "@/lib/llm";

export const runtime = "nodejs";

const BodySchema = z.object({
  answer: z.string().min(1).max(10000),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = sessions.get(id);
  if (!session) return new Response("not found", { status: 404 });
  if (session.finished) return new Response("already finished", { status: 400 });

  const current = session.turns[session.turns.length - 1];
  if (!current || current.answer !== undefined) {
    return new Response("no pending question", { status: 400 });
  }

  let answer: string;
  try {
    const json = await req.json();
    answer = BodySchema.parse(json).answer;
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  current.answer = answer;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        let buf = "";
        for await (const delta of evaluateAnswerStream(
          session.config,
          current.question,
          answer,
        )) {
          buf += delta;
          send("feedback-delta", { buffer: buf });
        }

        const feedback = parseFeedback(buf);
        current.feedback = feedback;
        send("feedback-complete", { feedback });

        const isLast = session.turns.length >= session.config.questionCount;
        if (isLast) {
          session.finished = true;
          session.finalReport = await generateFinalReport(session.config, session.turns);
          sessions.set(session);
          send("final-report", { finalReport: session.finalReport });
          send("done", { finished: true });
        } else {
          const next = await generateNextQuestion(session.config, session.turns);
          session.turns.push({ index: session.turns.length, question: next });
          sessions.set(session);
          send("next-question", { question: next });
          send("done", { finished: false });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        send("error", { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
