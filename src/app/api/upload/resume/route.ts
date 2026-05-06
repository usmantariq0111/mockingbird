import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    let text = "";
    if (name.endsWith(".pdf")) {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default;
      const result = await pdfParse(buf);
      text = result.text;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buf.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, TXT, or MD." },
        { status: 400 },
      );
    }

    text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
