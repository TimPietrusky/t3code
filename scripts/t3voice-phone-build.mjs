// Keeps t3 voice's phone build current: `vp build --watch` merged into apps/web/dist (hashed assets
// only added, so older pages still load their chunks); PhoneBuildReload.tsx reloads on a new build
// id. The voice page's extras build separately into dist/t3voice-extras, published on every build:
// VoiceExtrasSlot swaps them in without a reload.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const root = NodePath.resolve(import.meta.dirname, "..");
const web = NodePath.join(root, "apps/web");
const dist = NodePath.resolve(process.env.T3VOICE_PHONE_STATIC ?? NodePath.join(web, "dist"));
const stage = NodePath.join(web, "node_modules/.t3voice-stage");
const extrasStage = NodePath.join(web, "node_modules/.t3voice-extras-stage");
const extrasDist = NodePath.join(dist, "t3voice-extras");

const log = (message) => console.log(`${new Date().toISOString()} ${message}`);

function copyIfMissing(from, to) {
  for (const entry of NodeFS.readdirSync(from, { withFileTypes: true })) {
    const source = NodePath.join(from, entry.name);
    const target = NodePath.join(to, entry.name);
    if (entry.isDirectory()) {
      NodeFS.mkdirSync(target, { recursive: true });
      copyIfMissing(source, target);
    } else if (!NodeFS.existsSync(target)) {
      NodeFS.copyFileSync(source, target);
    }
  }
}

function replaceAtomically(source, target) {
  const temporary = `${target}.next`;
  NodeFS.copyFileSync(source, temporary);
  NodeFS.renameSync(temporary, target);
}

function publish(startedAt) {
  NodeFS.mkdirSync(NodePath.join(dist, "assets"), { recursive: true });
  copyIfMissing(NodePath.join(stage, "assets"), NodePath.join(dist, "assets"));
  for (const entry of NodeFS.readdirSync(stage, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== "assets") {
        NodeFS.cpSync(NodePath.join(stage, entry.name), NodePath.join(dist, entry.name), {
          recursive: true,
        });
      }
    } else if (entry.name !== "index.html") {
      replaceAtomically(NodePath.join(stage, entry.name), NodePath.join(dist, entry.name));
    }
  }
  replaceAtomically(NodePath.join(stage, "index.html"), NodePath.join(dist, "index.html"));
  const id = `${Date.now()}`;
  const version = NodePath.join(dist, "t3voice-build.json");
  NodeFS.writeFileSync(`${version}.next`, JSON.stringify({ id }));
  NodeFS.renameSync(`${version}.next`, version);
  log(
    `published build ${id}${startedAt ? ` (${Date.now() - startedAt} ms after the change)` : ""}`,
  );
  // The same line in the session log (apps/web/vite/sessionLog.ts), so a reload has its cause there.
  try {
    const day = new Date().toLocaleDateString("sv-SE");
    const dir = NodePath.join(process.env.HOME ?? "", "Library/Logs/t3voice");
    NodeFS.mkdirSync(dir, { recursive: true });
    NodeFS.appendFileSync(
      NodePath.join(dir, `sessions-${day}.jsonl`),
      `${JSON.stringify({ at: new Date().toISOString(), who: "system", type: "build.published", id, head: head() })}\n`,
    );
  } catch {}
}

NodeFS.rmSync(stage, { recursive: true, force: true });
const build = NodeChildProcess.spawn(
  NodePath.join(root, "node_modules/.bin/vp"),
  ["build", "--watch", "--outDir", stage, "--emptyOutDir"],
  { cwd: web, env: { ...process.env, VITE_T3VOICE: "1" }, stdio: ["ignore", "pipe", "pipe"] },
);

// One phone build per change set, never one per save: a finished build is only staged; it is
// published when a commit lands (HEAD moves: the brain commits each change) or when edits have
// settled for SETTLE_MS without one, and never while a newer build is still running.
const SETTLE_MS = 20_000;
let startedAt = 0;
let building = false;
let staged = false;
let lastBuiltAt = 0;
let publishedHead = null;
const head = () => {
  try {
    return NodeChildProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
      .toString()
      .trim();
  } catch {
    return null;
  }
};
function maybePublish() {
  if (!staged || building) return;
  const now = head();
  const committed = now !== null && now !== publishedHead;
  if (!committed && Date.now() - lastBuiltAt < SETTLE_MS) return;
  try {
    publish(startedAt);
    publishedHead = now;
    staged = false;
    startedAt = 0;
  } catch (error) {
    log(`publish failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function onOutput(chunk) {
  for (const line of String(chunk).split("\n")) {
    if (/build started|file changed|changed/i.test(line)) {
      building = true;
      if (startedAt === 0) startedAt = Date.now();
    }
    if (/built in [\d.]+\s*m?s/i.test(line)) {
      building = false;
      staged = true;
      lastBuiltAt = Date.now();
      // The first build after start goes out at once.
      if (publishedHead === null) publishedHead = "";
      maybePublish();
    } else if (/\bError\b|\[error\]|failed to/.test(line)) {
      log(line.trim());
    }
  }
}
setInterval(maybePublish, 2_000);
build.stdout.on("data", onOutput);
build.stderr.on("data", onOutput);
build.on("exit", (code) => {
  log(`vp build --watch exited (${code}); launchd restarts it`);
  extras.kill("SIGTERM");
  process.exit(code ?? 1);
});

// Extras swap in live, so each finished build goes out at once; a failed one leaves the last.
function publishExtras() {
  NodeFS.mkdirSync(extrasDist, { recursive: true });
  replaceAtomically(
    NodePath.join(extrasStage, "extras.js"),
    NodePath.join(extrasDist, "extras.js"),
  );
  const css = NodeFS.existsSync(NodePath.join(extrasStage, "extras.css"));
  if (css) {
    replaceAtomically(
      NodePath.join(extrasStage, "extras.css"),
      NodePath.join(extrasDist, "extras.css"),
    );
  }
  const id = `${Date.now()}`;
  const version = NodePath.join(extrasDist, "build.json");
  NodeFS.writeFileSync(`${version}.next`, JSON.stringify({ id, css }));
  NodeFS.renameSync(`${version}.next`, version);
  log(`published extras ${id}`);
}
const extras = NodeChildProcess.spawn(
  NodePath.join(root, "node_modules/.bin/vp"),
  ["build", "--watch", "--config", "src/voice/extras.config.ts", "--outDir", extrasStage],
  { cwd: web, env: { ...process.env, VITE_T3VOICE: "1" }, stdio: ["ignore", "pipe", "pipe"] },
);
function onExtrasOutput(chunk) {
  for (const line of String(chunk).split("\n")) {
    if (/built in [\d.]+\s*m?s/i.test(line)) {
      try {
        publishExtras();
      } catch (error) {
        log(`extras publish failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (/\bError\b|\[error\]|failed to|may import only/.test(line)) {
      log(`extras: ${line.trim()}`);
    }
  }
}
extras.stdout.on("data", onExtrasOutput);
extras.stderr.on("data", onExtrasOutput);
extras.on("exit", (code) => {
  log(`extras build --watch exited (${code}); launchd restarts it`);
  build.kill("SIGTERM");
  process.exit(code ?? 1);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    build.kill(signal);
    extras.kill(signal);
    process.exit(0);
  });
}
log(`watching apps/web for the phone build -> ${dist}`);
