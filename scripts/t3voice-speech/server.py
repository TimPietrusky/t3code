"""
Local speech for t3 voice: Parakeet TDT 0.6B v2 (speech-to-text) and Kokoro 82M (text-to-speech,
American "af_heart" voice), both on MLX. Binds loopback only; the browser reaches it through the
t3 voice dev server (`/__t3voice/local/*`), never directly.

  GET  /health       {"ready": bool, ...}
  POST /tts          {"text"} -> raw 16-bit 24 kHz mono PCM, streamed per sentence
  POST /stt          16 kHz mono 16-bit WAV -> {"text"}
  WS   /stt/stream   ElevenLabs Scribe realtime's message shapes: input_audio_chunk in (base64
                     16 kHz PCM, `commit`), session_started / partial_transcript /
                     committed_transcript out. Partials re-transcribe the open segment.

Start with scripts/t3voice-speech.sh, which owns the venv and the model cache.
"""

import asyncio
import base64
import io
import json
import os
import re
import sys
import time
import wave
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import mlx.core as mx
import numpy as np
import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse

STT_MODEL = os.environ.get("T3VOICE_LOCAL_STT", "mlx-community/parakeet-tdt-0.6b-v2")
TTS_MODEL = os.environ.get("T3VOICE_LOCAL_TTS", "mlx-community/Kokoro-82M-bf16")
VOICE = os.environ.get("T3VOICE_LOCAL_VOICE", "af_heart")
SPEED = float(os.environ.get("T3VOICE_LOCAL_SPEED", "1.0"))
PORT = int(os.environ.get("T3VOICE_LOCAL_PORT", "5797"))
STT_RATE = 16_000
MAX_SEGMENT_S = 60
PARTIAL_EVERY_S = 0.25
MIN_PARTIAL_S = 0.4
MAX_TTS_CHARS = 1_200

# One thread runs every model call: MLX work stays ordered and never runs concurrently.
gpu = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")
models: dict = {}


def log(*parts) -> None:
    print(time.strftime("%H:%M:%S"), *parts, file=sys.stderr, flush=True)


def load_models() -> None:
    from mlx_audio.stt import load as load_stt
    from mlx_audio.tts.utils import load as load_tts

    # Keep freed Metal buffers from piling up next to T3 and its agents.
    mx.set_cache_limit(256 * 1024 * 1024)
    started = time.time()
    models["stt"] = load_stt(STT_MODEL)
    # The published Parakeet weights are fp32 (2.3 GB); bf16 halves that with the same transcripts.
    models["stt"].set_dtype(mx.bfloat16)
    models["tts"] = load_tts(TTS_MODEL)
    # First calls load the phonemizer and compile kernels (~1.5 s); pay that before anyone waits.
    # Real speech, so the transcriber's decoder runs too: silence never reaches it.
    spoken = b"".join(synthesize("Ready when you are. What should we work on first?"))
    at_24k = pcm16_to_float(spoken)
    transcribe_pcm(np.interp(np.arange(0, at_24k.size, 1.5), np.arange(at_24k.size), at_24k))
    mx.clear_cache()
    log(f"models ready in {time.time() - started:.1f}s ({STT_MODEL}, {TTS_MODEL} {VOICE})")


def transcribe_pcm(samples: np.ndarray) -> str:
    if samples.size < STT_RATE // 10:
        return ""
    try:
        result = models["stt"].generate(mx.array(samples))
        return result.text.strip()
    finally:
        mx.clear_cache()


def synthesize(text: str):
    """Yields 16-bit PCM bytes, one piece per sentence of `text`."""
    try:
        for result in models["tts"].generate(
            text=text,
            voice=VOICE,
            speed=SPEED,
            lang_code="a",
            split_pattern=r"(?<=[.!?;:])\s+|\n+",
        ):
            audio = np.clip(np.array(result.audio, dtype=np.float32), -1.0, 1.0)
            yield (audio * 32767).astype("<i2").tobytes()
    finally:
        mx.clear_cache()


def pcm16_to_float(data: bytes) -> np.ndarray:
    return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0


@asynccontextmanager
async def lifespan(_app):
    # Serve /health ("ready": false) while the models load, so a slow start never looks like "down".
    loading = asyncio.get_running_loop().run_in_executor(gpu, load_models)
    yield
    loading.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ready": "tts" in models, "stt": STT_MODEL, "tts": TTS_MODEL, "voice": VOICE}


@app.post("/tts")
async def tts(request: Request):
    if "tts" not in models:
        return JSONResponse({"error": "local speech is still loading"}, status_code=503)
    body = await request.json()
    text = str(body.get("text", "")).strip()[:MAX_TTS_CHARS]
    if not text:
        return JSONResponse({"error": "no text"}, status_code=400)
    loop = asyncio.get_running_loop()
    pieces = synthesize(text)
    done = object()

    async def stream():
        try:
            while not await request.is_disconnected():
                piece = await loop.run_in_executor(gpu, next, pieces, done)
                if piece is done:
                    return
                yield piece
        finally:
            # A reply cut off by barge-in stops after the sentence piece in progress.
            await loop.run_in_executor(gpu, pieces.close)

    return StreamingResponse(stream(), media_type="application/octet-stream")


@app.post("/stt")
async def stt(request: Request):
    if "stt" not in models:
        return JSONResponse({"error": "local speech is still loading"}, status_code=503)
    raw = await request.body()
    try:
        with wave.open(io.BytesIO(raw)) as wav:
            if wav.getframerate() != STT_RATE or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                return JSONResponse({"error": "expected 16 kHz mono 16-bit wav"}, status_code=400)
            pcm = wav.readframes(wav.getnframes())
    except (wave.Error, EOFError):
        return JSONResponse({"error": "not a wav file"}, status_code=400)
    text = await asyncio.get_running_loop().run_in_executor(gpu, transcribe_pcm, pcm16_to_float(pcm))
    return {"text": text}


@app.websocket("/stt/stream")
async def stt_stream(socket: WebSocket):
    await socket.accept()
    if "stt" not in models:
        await socket.send_json({"message_type": "error", "error": "local speech is still loading"})
        await socket.close()
        return
    loop = asyncio.get_running_loop()
    segment: list[np.ndarray] = []
    samples = 0
    since_partial = 0
    partial: asyncio.Task | None = None
    generation = 0

    async def send_partial(audio: np.ndarray, of_generation: int) -> None:
        text = await loop.run_in_executor(gpu, transcribe_pcm, audio)
        # A partial that finishes after its segment was committed would mislabel the next one.
        if text and of_generation == generation:
            await socket.send_json({"message_type": "partial_transcript", "text": text})

    await socket.send_json({"message_type": "session_started"})
    try:
        while True:
            message = json.loads(await socket.receive_text())
            if message.get("message_type") != "input_audio_chunk":
                continue
            chunk = pcm16_to_float(base64.b64decode(message.get("audio_base_64") or ""))
            segment.append(chunk)
            samples += chunk.size
            since_partial += chunk.size
            while samples > MAX_SEGMENT_S * STT_RATE and len(segment) > 1:
                samples -= segment.pop(0).size
            if message.get("commit"):
                audio = np.concatenate(segment) if segment else np.zeros(0, np.float32)
                segment, samples, since_partial = [], 0, 0
                generation += 1
                text = await loop.run_in_executor(gpu, transcribe_pcm, audio)
                await socket.send_json({"message_type": "committed_transcript", "text": text})
            elif (
                since_partial >= PARTIAL_EVERY_S * STT_RATE
                and samples >= MIN_PARTIAL_S * STT_RATE
                and (partial is None or partial.done())
            ):
                since_partial = 0
                partial = asyncio.create_task(send_partial(np.concatenate(segment), generation))
    except (WebSocketDisconnect, RuntimeError):
        pass


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning", ws_max_size=4 * 1024 * 1024)
