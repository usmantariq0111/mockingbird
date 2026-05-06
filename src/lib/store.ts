import type { Session } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __mockInterviewStore: Map<string, Session> | undefined;
}

const store: Map<string, Session> =
  globalThis.__mockInterviewStore ?? new Map<string, Session>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__mockInterviewStore = store;
}

export const sessions = {
  get(id: string) {
    return store.get(id);
  },
  set(session: Session) {
    store.set(session.id, session);
    return session;
  },
  delete(id: string) {
    store.delete(id);
  },
  list() {
    return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
};
