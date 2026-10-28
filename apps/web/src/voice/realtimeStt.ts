/**
 * Streaming speech-to-text through ElevenLabs Scribe realtime. The dev server mints a single-use
 * token (`/__t3voice/stt-token`), the browser streams 16 kHz PCM only while Tim is talking, and a
 * manual commit at the end of each utterance returns its final transcript within a few hundred
 * milliseconds. When the socket is unavailable, the utterance goes to the batch endpoint instead.
 */
export const STT_SAMPLE_RATE = 16_000;

const COMMIT_TIMEOUT_MS = 3_000;
const CONNECT_TIMEOUT_MS = 4_000;

function base64OfPcm(chunks: ReadonlyArray<Int16Array>): string {
  let length = 0;
  for (const chunk of chunks) length += chunk.byteLength;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
    offset += chunk.byteLength;
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function wavOfPcm(chunks: ReadonlyArray<Int16Array>): Blob {
  let samples = 0;
  for (const chunk of chunks) samples += chunk.length;
  const header = new DataView(new ArrayBuffer(44));
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      header.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  header.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, STT_SAMPLE_RATE, true);
  header.setUint32(28, STT_SAMPLE_RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  write(36, "data");
  header.setUint32(40, samples * 2, true);
  return new Blob([header.buffer, ...chunks.map((chunk) => chunk.slice().buffer)], {
    type: "audio/wav",
  });
}

async function transcribeBatch(chunks: ReadonlyArray<Int16Array>): Promise<string> {
  const response = await fetch("/__t3voice/stt", {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    body: wavOfPcm(chunks),
  });
  const body = (await response.json()) as { text?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? `transcription failed (${response.status})`);
  return body.text?.trim() ?? "";
}

type PendingCommit = {
  readonly resolve: (text: string) => void;
  readonly reject: (error: Error) => void;
};

export class RealtimeStt {
  private socket: WebSocket | null = null;
  private ready: Promise<WebSocket> | null = null;
  private pending: PendingCommit[] = [];
  private closed = false;
  /** The current utterance, kept for the batch fallback. */
  private utterance: Int16Array[] = [];
  /** Interim text of the segment being streamed; used to tell Tim from our own echo. */
  onPartial: ((text: string) => void) | null = null;
  private unsent: Int16Array[] = [];

  /** Opens the socket ahead of time so the first utterance does not wait for it. */
  warm(): void {
    void this.connect().catch(() => {});
  }

  close(): void {
    this.closed = true;
    for (const commit of this.pending) commit.reject(new Error("closed"));
    this.pending = [];
    this.socket?.close();
    this.socket = null;
    this.ready = null;
  }

  /** Streams audio of the utterance in progress; sends in ~100 ms batches. */
  push(chunk: Int16Array): void {
    this.utterance.push(chunk);
    this.unsent.push(chunk);
    if (this.unsent.length >= 5) this.flush(false);
  }

  /** Drops the utterance in progress (it was noise or our own echo). */
  discard(): void {
    this.utterance = [];
    this.unsent = [];
  }

  /** Ends the utterance and resolves with its transcript. `fallback: false` skips the batch retry. */
  async commit({ fallback = true }: { readonly fallback?: boolean } = {}): Promise<string> {
    const utterance = this.utterance;
    const commit = new Promise<string>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
    // Every commit carries some audio, even when the batches already went out.
    if (this.unsent.length === 0) this.unsent.push(new Int16Array(STT_SAMPLE_RATE / 50));
    const sent = this.flush(true);
    this.utterance = [];
    if (!sent) {
      this.pending.pop();
      return fallback ? transcribeBatch(utterance) : "";
    }
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error("commit timed out")), COMMIT_TIMEOUT_MS);
    });
    try {
      const text = await Promise.race([commit, timeout]);
      // A session that reconnected mid-utterance can commit only silence; the batch has it all.
      return text === "" && fallback ? await transcribeBatch(utterance) : text;
    } catch {
      // A dropped socket or a slow commit: the batch endpoint still has the whole utterance.
      this.socket?.close();
      return fallback ? transcribeBatch(utterance) : "";
    } finally {
      window.clearTimeout(timer);
    }
  }

  private flush(commit: boolean): boolean {
    const socket = this.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      this.warm();
      return false;
    }
    const chunks = this.unsent;
    this.unsent = [];
    socket.send(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: base64OfPcm(chunks),
        commit,
        sample_rate: STT_SAMPLE_RATE,
      }),
    );
    return true;
  }

  private connect(): Promise<WebSocket> {
    if (this.ready !== null) return this.ready;
    this.closed = false;
    const ready = (async () => {
      const response = await fetch("/__t3voice/stt-token", { method: "POST" });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) throw new Error(body.error ?? "no speech token");
      const params = new URLSearchParams({
        model_id: "scribe_v2_realtime",
        audio_format: "pcm_16000",
        commit_strategy: "manual",
        token: body.token,
      });
      const socket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`);
      socket.onmessage = (event) => this.onMessage(event);
      // ElevenLabs closes a session after ~15 s without audio; the next utterance reconnects.
      socket.onclose = () => {
        if (this.socket !== socket && this.socket !== null) return;
        this.socket = null;
        if (this.ready === ready) this.ready = null;
        for (const commit of this.pending) commit.reject(new Error("socket closed"));
        this.pending = [];
      };
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error("connect timed out")),
          CONNECT_TIMEOUT_MS,
        );
        socket.addEventListener("message", function started(event) {
          if (String(event.data).includes("session_started")) {
            window.clearTimeout(timer);
            socket.removeEventListener("message", started);
            resolve();
          }
        });
        socket.addEventListener("close", () => reject(new Error("socket closed")), { once: true });
      });
      if (this.closed) {
        socket.close();
        throw new Error("closed");
      }
      this.socket = socket;
      return socket;
    })();
    ready.catch(() => {
      if (this.ready === ready) this.ready = null;
    });
    this.ready = ready;
    return ready;
  }

  private onMessage(event: MessageEvent): void {
    let message: { message_type?: string; text?: string; error?: string };
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.message_type === "partial_transcript") {
      if (message.text) this.onPartial?.(message.text);
    } else if (message.message_type === "committed_transcript") {
      this.pending.shift()?.resolve(message.text?.trim() ?? "");
    } else if (message.error !== undefined) {
      this.pending.shift()?.reject(new Error(message.error));
    }
  }
}
