import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mockingbird — AI Interview Practice",
  description:
    "Practice technical, behavioral, system design, and coding interviews with an AI interviewer that gives real feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground text-sm">
                M
              </span>
              <span>Mockingbird</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted-foreground">
              <Link href="/setup" className="hover:text-foreground">
                New session
              </Link>
              <Link href="/sessions" className="hover:text-foreground">
                History
              </Link>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                Get API key
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
          Built for honest practice. Not for live-interview cheating.
        </footer>
      </body>
    </html>
  );
}
