// @effect-diagnostics-next-line nodeBuiltinImport:off -- Vite config runs before any Effect runtime.
import * as NodePath from "node:path";
import type { Connect, Plugin } from "vite-plus";

/**
 * Dev-only speech endpoints for t3 voice (`apps/web/src/voice`). The ElevenLabs key stays in this
 * Vite process; the browser only sends audio or text to `/__t3voice/*` on its own origin.
 * Start through `scripts/t3voice.sh`, which loads the key into this process's environment.
 */
const API = "https://api.elevenlabs.io";
const PREFIX = "/__t3voice";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_TTS_CHARS = 1_200;

const voiceKey = () =>
  process.env.ELEVENLABS_API_KEY_AGENT_DASHBOARD?.trim() ||
  process.env.ELEVENLABS_API_KEY?.trim() ||
  "";

// Jessica: clear American English, the voice Presence uses.
const voiceId = () => process.env.T3VOICE_VOICE_ID?.trim() || "cgSgspJ2msm6clMCkdW9";
const ttsModel = () => process.env.T3VOICE_TTS_MODEL?.trim() || "eleven_flash_v2_5";
const sttModel = () => process.env.T3VOICE_STT_MODEL?.trim() || "scribe_v2";

const workspaceRoot = NodePath.resolve(import.meta.dirname, "../../..");

function readBody(req: Connect.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const describe = (error: unknown): string =>
  error instanceof Error && error.cause !== undefined
    ? `${error.message}: ${String(error.cause)}`
    : String(error);

// ElevenLabs drops idle keep-alive sockets; the first request after a pause can hit a dead one.
async function fetchElevenLabs(path: string, init: RequestInit): Promise<Response> {
  const attempt = () => fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(20_000) });
  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return attempt();
  }
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function transcribe(audio: Buffer, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", sttModel());
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([new Uint8Array(audio)], { type: contentType }), "speech.webm");
  const response = await fetchElevenLabs("/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": voiceKey() },
    body: form,
  });
  if (!response.ok) throw new Error(`speech-to-text answered ${response.status}`);
  const body = (await response.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text.trim() : "";
}

export function t3VoicePlugin(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith(`${PREFIX}/`)) return next();
    const route = url.slice(PREFIX.length).split("?")[0];

    if (route === "/config" && req.method === "GET") {
      sendJson(res, 200, {
        speech: voiceKey() !== "",
        workspaceRoot,
        model: process.env.T3VOICE_MODEL?.trim() || null,
      });
      return;
    }
    if (voiceKey() === "") {
      sendJson(res, 503, {
        error: "No ElevenLabs key in the dev server; start it with scripts/t3voice.sh.",
      });
      return;
    }

    if (route === "/stt" && req.method === "POST") {
      readBody(req, MAX_AUDIO_BYTES)
        .then((audio) => transcribe(audio, req.headers["content-type"] ?? "audio/webm"))
        .then((text) => sendJson(res, 200, { text }))
        .catch((error: unknown) => sendJson(res, 502, { error: describe(error) }));
      return;
    }

    if (route === "/tts" && req.method === "POST") {
      readBody(req, 64 * 1024)
        .then(async (raw) => {
          const { text } = JSON.parse(raw.toString("utf8")) as { text?: unknown };
          if (typeof text !== "string" || text.trim() === "") throw new Error("no text");
          const response = await fetchElevenLabs(
            `/v1/text-to-speech/${encodeURIComponent(voiceId())}/stream?output_format=mp3_44100_64`,
            {
              method: "POST",
              headers: { "xi-api-key": voiceKey(), "content-type": "application/json" },
              body: JSON.stringify({
                text: text.slice(0, MAX_TTS_CHARS),
                model_id: ttsModel(),
                voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
              }),
            },
          );
          if (!response.ok || response.body === null) {
            throw new Error(`text-to-speech answered ${response.status}`);
          }
          res.statusCode = 200;
          res.setHeader("content-type", "audio/mpeg");
          res.setHeader("cache-control", "no-store");
          for await (const chunk of response.body) res.write(chunk);
          res.end();
        })
        .catch((error: unknown) => {
          if (res.headersSent) res.end();
          else sendJson(res, 502, { error: describe(error) });
        });
      return;
    }

    sendJson(res, 404, { error: "unknown voice route" });
  };

  return {
    name: "t3code:voice",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(handle);
    },
  };
}
