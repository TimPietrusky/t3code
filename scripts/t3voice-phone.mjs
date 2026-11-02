// Loopback front door for t3 voice on a phone. `scripts/t3voice.sh phone` publishes this port
// with `netbird expose` (HTTPS, NetBird SSO for one group); it forwards to the t3 voice dev server
// and refuses MCP and OAuth, so the phone only gets the web client and its paired T3 session.
import * as NodeHttp from "node:http";
import * as NodeNet from "node:net";

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

const server = NodeHttp.createServer((req, res) => {
  if (refused(req.url)) {
    logLine(req.method, req.url, 404);
    res.writeHead(404).end();
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
      if (
        !req.url?.startsWith("/src/") &&
        !req.url?.startsWith("/@") &&
        !req.url?.startsWith("/node_modules/")
      ) {
        logLine(req.method, req.url, response.statusCode);
      }
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
