/**
 * Tiny Server-Sent Events client over fetch.
 *
 * Browsers ship `EventSource` but it doesn't support POST or custom bodies,
 * which we need. So we read the response as a stream and split on `\n\n`.
 */
export interface SseEvent {
  event: string;
  data: unknown;
}

export async function* readSse(res: Response): AsyncGenerator<SseEvent> {
  if (!res.body) throw new Error("Response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const evtLine = block.match(/^event: (.+)$/m);
      const dataLine = block.match(/^data: (.+)$/m);
      if (!evtLine || !dataLine) continue;
      try {
        yield { event: evtLine[1], data: JSON.parse(dataLine[1]) };
      } catch {
        // ignore malformed
      }
    }
  }
}
