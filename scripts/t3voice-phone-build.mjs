// Keeps t3 voice's phone build current while the brain edits the UI: `vp build --watch` into a
// staging folder, merged into apps/web/dist (hashed assets only added, so older pages still load
// their chunks; index.html and t3voice-build.json swapped atomically). PhoneBuildReload.tsx reloads
// the page on a new build id.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const root = NodePath.resolve(import.meta.dirname, "..");
const web = NodePath.join(root, "apps/web");
const dist = NodePath.resolve(process.env.T3VOICE_PHONE_STATIC ?? NodePath.join(web, "dist"));
const stage = NodePath.join(web, "node_modules/.t3voice-stage");

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
}

NodeFS.rmSync(stage, { recursive: true, force: true });
const build = NodeChildProcess.spawn(
  NodePath.join(root, "node_modules/.bin/vp"),
  ["build", "--watch", "--outDir", stage, "--emptyOutDir"],
  { cwd: web, env: { ...process.env, VITE_T3VOICE: "1" }, stdio: ["ignore", "pipe", "pipe"] },
);

let startedAt = 0;
function onOutput(chunk) {
  for (const line of String(chunk).split("\n")) {
    if (/build started|file changed|changed/i.test(line) && startedAt === 0) startedAt = Date.now();
    if (/built in [\d.]+\s*m?s/i.test(line)) {
      try {
        publish(startedAt);
      } catch (error) {
        log(`publish failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      startedAt = 0;
    } else if (/\bError\b|\[error\]|failed to/.test(line)) {
      log(line.trim());
    }
  }
}
build.stdout.on("data", onOutput);
build.stderr.on("data", onOutput);
build.on("exit", (code) => {
  log(`vp build --watch exited (${code}); launchd restarts it`);
  process.exit(code ?? 1);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    build.kill(signal);
    process.exit(0);
  });
}
log(`watching apps/web for the phone build -> ${dist}`);
