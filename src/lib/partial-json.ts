/**
 * Forgiving JSON parser for streaming structured outputs.
 *
 * As tokens arrive from the LLM, the buffer is invalid JSON for most of the
 * stream (`{"summary":"the team`, etc). We close any open string, balance
 * braces/brackets, drop trailing keys/colons/commas, and try JSON.parse. If it
 * still fails we return null and the caller waits for the next chunk.
 */
export function parsePartialJson<T = unknown>(buffer: string): T | null {
  if (!buffer || !buffer.trim()) return null;

  const start = buffer.indexOf("{");
  if (start < 0) return null;
  let s = buffer.slice(start);

  let inStr = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }

  if (inStr) s += '"';
  s = s.replace(/[,:\s]+$/, "");
  s = s.replace(/"[^"]*$/, "");
  s = s.replace(/[,:\s]+$/, "");
  while (stack.length > 0) s += stack.pop();

  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
