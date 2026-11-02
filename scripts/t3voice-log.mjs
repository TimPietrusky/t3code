// Prints t3 voice's last session (or `--session <id>`, or `--all` for the whole day) readably from
// ~/Library/Logs/t3voice/sessions-YYYY-MM-DD.jsonl (`--day YYYY-MM-DD` for another day).
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};
const dir =
  process.env.T3VOICE_LOG_DIR ?? NodePath.join(process.env.HOME ?? "", "Library/Logs/t3voice");
const day = flag("--day") ?? new Date().toLocaleDateString("sv-SE");
const file = NodePath.join(dir, `sessions-${day}.jsonl`);
if (!NodeFS.existsSync(file)) {
  console.error(`No session log for ${day} (${file}).`);
  process.exit(1);
}
const events = NodeFS.readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);
const sessions = [...new Set(events.map((event) => event.session).filter(Boolean))];
const wanted = args.includes("--all") ? null : (flag("--session") ?? sessions.at(-1) ?? null);
const shown = wanted === null ? events : events.filter((event) => event.session === wanted);
if (wanted !== null) {
  // The page and build events around the session too (reloads, builds), by time.
  const first = shown[0]?.at ?? "";
  const last = shown.at(-1)?.at ?? "";
  shown.push(
    ...events.filter(
      (event) => !event.session && event.who === "system" && event.at >= first && event.at <= last,
    ),
  );
  shown.sort((a, b) => (a.at < b.at ? -1 : 1));
}
const quote = (text) => (text ? `"${text}"` : "");
const line = (event) => {
  const { at, t, page: _page, session: _session, who, type, ...rest } = event;
  const time = (t ?? at ?? "").slice(11, 23);
  const text = rest.text ?? rest.heard ?? rest.cut ?? rest.partial ?? "";
  delete rest.text;
  delete rest.heard;
  delete rest.cut;
  const extra = Object.entries(rest)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" ");
  return `${time}  ${String(who).padEnd(6)} ${String(type).padEnd(18)} ${quote(text)} ${extra}`.trimEnd();
};
console.log(`${file}${wanted ? `  session ${wanted}` : ""}  (${sessions.length} sessions today)`);
for (const event of shown) console.log(line(event));
