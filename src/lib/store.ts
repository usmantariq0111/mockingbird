import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import type { Session } from "./types";

/**
 * File-backed session store.
 *
 * Single user, single process — fine for local dev. Writes are atomic:
 * we write to a `.tmp` file then rename it over the target so a crash
 * mid-write can't corrupt the store.
 *
 * The Map is the hot cache for reads; writes go to disk synchronously.
 * For a session-count in the low thousands this is plenty fast.
 */

const DATA_DIR = join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "sessions.json");

declare global {
  // eslint-disable-next-line no-var
  var __mockInterviewStore: Map<string, Session> | undefined;
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk(): Map<string, Session> {
  if (!existsSync(FILE)) return new Map();
  try {
    const raw = readFileSync(FILE, "utf-8");
    if (!raw.trim()) return new Map();
    const parsed = JSON.parse(raw) as Session[];
    return new Map(parsed.map((s) => [s.id, s]));
  } catch (err) {
    console.error("[store] Failed to load sessions.json, starting fresh:", err);
    return new Map();
  }
}

const store: Map<string, Session> =
  globalThis.__mockInterviewStore ?? loadFromDisk();

if (process.env.NODE_ENV !== "production") {
  globalThis.__mockInterviewStore = store;
}

function persist(): void {
  try {
    ensureDir();
    const arr = Array.from(store.values());
    const tmp = FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(arr, null, 2), "utf-8");
    renameSync(tmp, FILE);
  } catch (err) {
    console.error("[store] Failed to persist sessions:", err);
  }
}

export const sessions = {
  get(id: string) {
    return store.get(id);
  },
  set(session: Session) {
    store.set(session.id, session);
    persist();
    return session;
  },
  delete(id: string) {
    store.delete(id);
    persist();
  },
  list() {
    return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
};
