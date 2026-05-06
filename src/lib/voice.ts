/**
 * Browser-native voice helpers.
 *
 * TTS: SpeechSynthesisUtterance — works everywhere modern (Chrome, Edge,
 * Safari, Firefox). Quality varies by OS voice catalog. macOS has very good
 * voices ("Samantha", "Daniel"), Windows is decent.
 *
 * STT: SpeechRecognition (webkit-prefixed in Chromium). Chrome/Edge use
 * Google's cloud STT under the hood — no API key required from the user, but
 * audio does leave the device. Safari implements it locally on macOS 14.5+
 * but quality is worse. Firefox does not implement it at all.
 *
 * No keys, no costs, no extra deps. The trade-off is browser availability.
 */

export interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
  resultIndex: number;
}

export interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

export function isSttSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isTtsSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

export function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice | null;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  if (cachedVoices && cachedVoices.length) return cachedVoices;
  const all = window.speechSynthesis.getVoices();
  cachedVoices = all.filter((v) => v.lang.startsWith("en"));
  return cachedVoices;
}

export function pickInterviewerVoice(): SpeechSynthesisVoice | null {
  const voices = getEnglishVoices();
  if (voices.length === 0) return null;
  // Prefer high-quality named voices in this order.
  const preferred = [
    "Samantha",
    "Daniel",
    "Karen",
    "Fred",
    "Microsoft Zira",
    "Google US English",
  ];
  for (const name of preferred) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }
  return voices.find((v) => v.lang === "en-US") || voices[0];
}

export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isTtsSupported()) {
      reject(new Error("TTS not supported in this browser"));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    if (opts.voice) u.voice = opts.voice;
    u.onend = () => resolve();
    u.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));
    window.speechSynthesis.speak(u);
  });
}

export function cancelSpeak(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}
