import Link from "next/link";

const features = [
  {
    title: "Behavioral",
    desc: "STAR-style stories. Get scored on Situation / Task / Action / Result coverage.",
  },
  {
    title: "Technical",
    desc: "Concepts, trade-offs, debugging, depth probing — calibrated to your seniority.",
  },
  {
    title: "System design",
    desc: "Open-ended architecture prompts with feedback on scaling and trade-offs.",
  },
  {
    title: "Coding",
    desc: "Algorithm and problem-solving prompts with structured critique of your approach.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border border-border/80 bg-muted px-3 py-1 text-xs text-muted-foreground">
          Mock interviews, honest feedback
        </span>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Practice interviews
          <br />
          <span className="text-muted-foreground">that actually push you.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          An AI interviewer drills you on your resume and the role you want. After every
          answer, you get specific, actionable feedback — not generic platitudes.
        </p>
        <div className="flex gap-3">
          <Link
            href="/setup"
            className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Start a mock interview
          </Link>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Get an OpenAI API key
          </a>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border/60 bg-muted/40 p-5 transition hover:border-border"
          >
            <h3 className="font-medium">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 grid gap-12 lg:grid-cols-3">
        <Step n={1} title="Tell us the role">
          Paste a job description and your resume. The AI uses both to generate questions
          tailored to you.
        </Step>
        <Step n={2} title="Answer one at a time">
          Type your answer. After each one, get a 0–10 score plus concrete strengths and
          fixes.
        </Step>
        <Step n={3} title="Read the report">
          End-of-session summary spots patterns across all your answers and tells you what
          to work on next.
        </Step>
      </section>

      <section className="mt-20 rounded-xl border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">A note on intent</p>
        <p className="mt-2">
          This tool is built for <em>practice before</em> the interview, not assistance{" "}
          <em>during</em> a live one. Real interviews exist so the company learns about
          your actual skills and you learn whether the role fits. Faking that helps no
          one.
        </p>
      </section>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm text-muted-foreground">
        {n}
      </div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
