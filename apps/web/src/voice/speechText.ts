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

const FILLER = /^(?:[mh]+|u+[hm]*|a+h+|o+h+|e+r+m*|hm+|huh|yeah|yep|yup)$/;
const WORD = /\p{L}[\p{L}'’]*|\d+/gu;
const words = (text: string) => text.toLowerCase().match(WORD) ?? [];

// Speech-to-text of our own echo is fuzzy ("octopus's" for "octopuses"): a shared stem counts.
function spokenMatcher(recentlySpoken: ReadonlyArray<string>): (word: string) => boolean {
  const spoken = new Set(recentlySpoken.flatMap(words));
  const stems = new Set(
    [...spoken].filter((word) => word.length >= 4).map((word) => word.slice(0, 4)),
  );
  // A cut-off fragment ("oxy" for "oxygen") counts too.
  return (word) =>
    spoken.has(word) ||
    (word.length >= 4 && stems.has(word.slice(0, 4))) ||
    (word.length >= 2 && [...spoken].some((said) => said.startsWith(word)));
}

/** The real words in `heard` that are not part of what we just said. */
export function foreignWords(
  heard: string,
  recentlySpoken: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const isSpoken = spokenMatcher(recentlySpoken);
  return words(heard).filter((word) => !FILLER.test(word) && !isSpoken(word));
}

/**
 * Whether `heard` has a run of words we did not say: Tim talking over the reply. A garbled echo
 * word comes alone; an interruption ("wait, stop") does not.
 */
export function hasForeignRun(
  heard: string,
  recentlySpoken: ReadonlyArray<string>,
  runLength = 2,
): boolean {
  const isSpoken = spokenMatcher(recentlySpoken);
  let run = 0;
  for (const word of words(heard)) {
    // Garbled echo often comes back as a filler sound ("mm-hmm", "uh").
    if (FILLER.test(word)) continue;
    run = isSpoken(word) ? 0 : run + 1;
    if (run >= runLength) return true;
  }
  return false;
}

/**
 * For an utterance that began while a reply was playing: keeps only the span of words that are not
 * the reply coming back through the mic. Returns "" when nothing of Tim's is left.
 */
export function stripEcho(transcript: string, recentlySpoken: ReadonlyArray<string>): string {
  const isSpoken = spokenMatcher(recentlySpoken);
  let first = -1;
  let last = -1;
  for (const match of transcript.matchAll(WORD)) {
    const word = match[0].toLowerCase();
    if (FILLER.test(word) || isSpoken(word)) continue;
    if (first === -1) first = match.index;
    last = match.index + match[0].length;
  }
  if (first === -1) return "";
  const end = transcript.slice(last).match(/^[.!?…]*/)?.[0].length ?? 0;
  return transcript.slice(first, last + end).trim();
}

/**
 * Whether a transcript is most likely our own reply picked up by the microphone: nearly all of
 * its words appear in what was just spoken. Real interruptions ("wait, stop") rarely do.
 */
export function isEchoOfSpoken(transcript: string, recentlySpoken: ReadonlyArray<string>): boolean {
  const heard = words(transcript);
  return heard.length >= 3 && foreignWords(transcript, recentlySpoken).length / heard.length <= 0.2;
}

/** Whether a transcript holds any real word, not just filler sounds or punctuation. */
export function hasRealWords(text: string): boolean {
  return words(text).some((word) => !FILLER.test(word));
}
