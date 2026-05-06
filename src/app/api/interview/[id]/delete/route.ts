import { NextResponse } from "next/server";
import { sessions } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  sessions.delete(id);
  return NextResponse.json({ ok: true });
}
