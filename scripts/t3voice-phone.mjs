// Loopback front door for t3 voice on a phone. `scripts/t3voice.sh phone` publishes this port
// with `netbird expose` (HTTPS, NetBird SSO for one group); it forwards to the t3 voice dev server
// and refuses MCP and OAuth, so the phone only gets the web client and its paired T3 session.
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import * as NodeNet from "node:net";
import * as NodePath from "node:path";
import * as NodeZlib from "node:zlib";

const listenPort = Number(process.env.T3VOICE_PHONE_PORT ?? 5791);
// Loopback for `netbird expose`; a persistent NetBird service reaches the Mac's NetBird address
// instead, like Presence. Only NetBird addresses (100.64.0.0/10), never a wildcard, LAN or public one.
const listenHost = process.env.T3VOICE_PHONE_BIND?.trim() || "127.0.0.1";
const [first, second] = listenHost.split(".").map(Number);
if (listenHost !== "127.0.0.1" && !(first === 100 && second >= 64 && second <= 127)) {
  throw new Error(`T3VOICE_PHONE_BIND=${listenHost} refused: only a NetBird address may be bound`);
}
const targetPort = Number(process.env.T3VOICE_PORT ?? 5790);
const REFUSED = [/^\/mcp(?:[/?]|$)/, /^\/oauth(?:[/?]|$)/, /^\/\.well-known\/oauth/];

const refused = (url = "") => REFUSED.some((pattern) => pattern.test(url));

// One line per request: method, path without its query, status. Never headers, cookies or bodies.
const logLine = (method, url = "", status) =>
  console.log(`${new Date().toISOString()} ${method} ${url.split("?")[0]} ${status}`);

// The reverse proxy may send its own Host; T3 checks the browser's Origin against the public one.
function forwardedHeaders(req) {
  const headers = { ...req.headers };
  const forwardedHost = String(req.headers["x-forwarded-host"] ?? "")
    .split(",")[0]
    .trim();
  if (forwardedHost) headers.host = forwardedHost;
  return headers;
}

// The phone gets the production build (T3VOICE_PHONE_STATIC=apps/web/dist): a few hashed bundles
// instead of the dev server's ~1,200 unbundled modules, which a phone on LTE behind the NetBird
// proxy could not load. Only the server routes go on to the dev server (and from there to T3).
const staticRoot = process.env.T3VOICE_PHONE_STATIC?.trim()
  ? NodePath.resolve(process.env.T3VOICE_PHONE_STATIC.trim())
  : null;
const FORWARDED = [
  /^\/api(?:[/?]|$)/,
  /^\/ws(?:[/?]|$)/,
  /^\/\.well-known\/t3\//,
  /^\/__t3voice\//,
];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
]);
const gzipCache = new Map();

function serveStatic(req, res) {
  const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = NodePath.join(staticRoot, NodePath.normalize(pathname));
  if (!file.startsWith(staticRoot)) return void res.writeHead(404).end();
  let stat = NodeFS.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    file = NodePath.join(file, "index.html");
    stat = NodeFS.statSync(file, { throwIfNoEntry: false });
  }
  // App routes (/pair, /<environment>/<thread>) are the single-page app's index.
  if (!stat && NodePath.extname(pathname) === "") {
    file = NodePath.join(staticRoot, "index.html");
    stat = NodeFS.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat) {
    logLine(req.method, req.url, 404);
    return void res.writeHead(404).end();
  }
  const ext = NodePath.extname(file);
  const headers = {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "cache-control": file.includes(`${NodePath.sep}assets${NodePath.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  };
  let body = NodeFS.readFileSync(file);
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
    const key = `${file}:${stat.mtimeMs}`;
    let gzipped = gzipCache.get(key);
    if (!gzipped) {
      gzipped = NodeZlib.gzipSync(body);
      gzipCache.set(key, gzipped);
    }
    body = gzipped;
    headers["content-encoding"] = "gzip";
    headers.vary = "accept-encoding";
  }
  headers["content-length"] = String(body.length);
  if (ext === ".html") logLine(req.method, req.url, 200);
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

const server = NodeHttp.createServer((req, res) => {
  if (refused(req.url)) {
    logLine(req.method, req.url, 404);
    res.writeHead(404).end();
    return;
  }
  if (staticRoot !== null && !FORWARDED.some((pattern) => pattern.test(req.url ?? ""))) {
    if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();
    try {
      serveStatic(req, res);
    } catch {
      logLine(req.method, req.url, 500);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
    return;
  }
  const upstream = NodeHttp.request(
    {
      host: "127.0.0.1",
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: forwardedHeaders(req),
    },
    (response) => {
      const quiet =
        /^\/(?:src|@|node_modules)\//.test(req.url ?? "") && (response.statusCode ?? 500) < 400;
      if (!quiet) logLine(req.method, req.url, response.statusCode);
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  if (refused(req.url)) {
    logLine("UPGRADE", req.url, "refused");
    socket.destroy();
    return;
  }
  logLine("UPGRADE", req.url, "->");
  const upstream = NodeNet.connect(targetPort, "127.0.0.1", () => {
    const headers = forwardedHeaders(req);
    const lines = Object.entries(headers).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value]).map((entry) => `${name}: ${entry}`),
    );
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(listenPort, listenHost, () => {
  console.log(
    `t3 voice phone front door on ${listenHost}:${listenPort} -> 127.0.0.1:${targetPort}`,
  );
});
