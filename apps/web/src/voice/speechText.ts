/** Replies are written for the ear, but strip any markdown that slips through before speaking. */
export function speakableText(text: string): string {
  const spoken = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /\p{L}/u.test(spoken) ? spoken.slice(0, 700) : "";
}

const LONG_FRAGMENT = 220;

/**
 * Splits the not-yet-spoken tail of a reply into sentences ready to speak. While the reply is
 * still streaming, the last fragment waits for its sentence to end; `final` flushes it. `consumed`
 * is how much of `tail` the sentences cover, so the caller can advance its offset.
 */
export function takeSentences(
  tail: string,
  final: boolean,
): { readonly sentences: ReadonlyArray<string>; readonly consumed: number } {
  // Never speak into an unfinished code block or link.
  let safe = tail;
  const fences = safe.split("```").length - 1;
  if (fences % 2 === 1) safe = safe.slice(0, safe.lastIndexOf("```"));
  if (!final) {
    const openLink = safe.lastIndexOf("[");
    if (openLink !== -1 && !safe.slice(openLink).includes(")")) safe = safe.slice(0, openLink);
  }

  const sentences: string[] = [];
  let consumed = 0;
  const boundary = /[.!?…]+["')\]]*(?=\s)|\n{2,}/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(safe)) !== null) {
    const end = match.index + match[0].length;
    sentences.push(safe.slice(consumed, end));
    consumed = end;
  }
  const rest = safe.slice(consumed);
  if (final && fences % 2 === 0) {
    if (rest.trim() !== "") sentences.push(rest);
    consumed = tail.length;
  } else if (rest.length > LONG_FRAGMENT) {
    // A run-on with no sentence end: speak up to its last comma or space.
    const cut = Math.max(rest.lastIndexOf(", "), rest.lastIndexOf(" "));
    if (cut > 0) {
      sentences.push(rest.slice(0, cut + 1));
      consumed += cut + 1;
    }
  }
  return { sentences: sentences.filter((sentence) => sentence.trim() !== ""), consumed };
}

const words = (text: string) => text.toLowerCase().match(/\p{L}[\p{L}'’]*|\d+/gu) ?? [];

/**
 * Whether a transcript is most likely our own reply picked up by the microphone: nearly all of
 * its words appear in what was just spoken. Real interruptions ("wait, stop") rarely do.
 */
export function isEchoOfSpoken(transcript: string, recentlySpoken: ReadonlyArray<string>): boolean {
  const heard = words(transcript);
  if (heard.length < 3) return false;
  const spoken = new Set(recentlySpoken.flatMap(words));
  const matching = heard.filter((word) => spoken.has(word)).length;
  return matching / heard.length >= 0.8;
}
