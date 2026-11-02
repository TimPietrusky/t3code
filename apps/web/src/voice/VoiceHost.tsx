import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/models";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { newMessageId, newThreadId } from "~/lib/utils";
import { useProjects, useThreadShells, useThreadVisibleTurnItems } from "../state/entities";
import { usePrimaryEnvironmentId } from "../state/environments";
import { primaryServerSettingsAtom } from "../state/server";
import { threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { markBriefed, needsBrief, withBrief } from "./brief";
import { speechEngine, useSpeechEngine } from "./engine";
import { type VoicePhase, VoiceSession } from "./speech";
import { takeSentences } from "./speechText";
import { VoiceBar, type VoiceBarState } from "./VoiceBar";
import { endVoiceLogSession, startVoiceLogSession, voiceLog } from "./voiceLog";
import { syncVoiceTheme } from "./voiceThemeSync";

// A T3VOICE_MODEL test run gets its own thread, so it never becomes the user's voice thread.
const voiceThreadTitle = (config: VoiceConfig | null) =>
  config?.model ? `voice test (${config.model})` : "voice";
// The hold line covers slow work: after this much silence once the brain runs a tool, or after the
// longer wait whatever it does; dropped if the real line lands first (eval 2 Nov: 6 of 19 plain
// answers got "One moment." a few hundred ms before the real line).
const HOLD_AFTER_MS = 3_500;
const HOLD_ANYWAY_MS = 7_000;
const HOLD_CHECK_MS = 250;
const HOLD_LINE = "One moment.";
// What the brain says or thinks; anything else in its turn (a command, a search, a file) is work.
const TALK_ITEMS = new Set([
  "user_message",
  "assistant_message",
  "reasoning",
  "notification",
  "system_notice",
  "checkpoint",
]);
const LOCAL_HEALTH_EVERY_MS = 10_000;

type VoiceConfig = {
  readonly speech: boolean;
  readonly workspaceRoot: string;
  /** T3VOICE_MODEL: a model for new voice threads instead of the default model's. */
  readonly model: string | null;
};

/**
 * t3 voice: a hands-free conversation with a "voice" thread in the fork's own project. Tim's
 * words go to that thread as turns, its finished replies are spoken back, and the thread (a normal
 * agent with T3's tools) acts on the instance or edits this UI. Ctrl+Option+V toggles the mic.
 */
export function VoiceHost() {
  const environmentId = usePrimaryEnvironmentId();
  const projects = useProjects();
  const shells = useThreadShells();
  const serverSettings = useAtomValue(primaryServerSettingsAtom);
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });

  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [error, setError] = useState<string | null>(null);
  // Between the tap and a live microphone (permission, speech socket): Presence's connecting look.
  const [starting, setStarting] = useState(false);
  // When Tim last cut a reply off; the bar shows Presence's stopped look.
  const [stoppedAt, setStoppedAt] = useState(0);
  const engine = useSpeechEngine();
  // Why local speech cannot be used right now (service down or loading); null when it is ready.
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const sessionStartedAtRef = useRef(0);
  // Says one short line when a turn has produced no speech for a while, so the loop never goes quiet.
  const holdTimerRef = useRef<number | null>(null);
  // When Tim's last words went to the thread (performance time), for the log's reply timings.
  const sentAtRef = useRef(0);
  /** The send's wall time, to tell this turn's items from the previous turn's. */
  const sentEpochRef = useRef(0);
  /** The brain started a tool in this turn (it will be slow). */
  const workStartedRef = useRef(false);
  const firstTextLoggedRef = useRef(false);
  // How much of each reply has been queued for speech, by turn item id.
  const spokenRef = useRef(new Map<string, number>());
  // The thread this client just created, until its shell arrives.
  const pendingThreadIdRef = useRef<ThreadId | null>(null);

  const project = projects.find(
    (candidate) =>
      candidate.environmentId === environmentId &&
      config !== null &&
      candidate.workspaceRoot === config.workspaceRoot,
  );
  const voiceThread = shells
    .filter(
      (shell) =>
        project !== undefined &&
        shell.environmentId === project.environmentId &&
        shell.projectId === project.id &&
        shell.title === voiceThreadTitle(config) &&
        shell.archivedAt === null &&
        shell.deletedAt === null,
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const voiceThreadRef = voiceThread
    ? scopeThreadRef(voiceThread.environmentId, voiceThread.id)
    : null;
  const items = useThreadVisibleTurnItems(phase === "off" ? null : voiceThreadRef);
  const thinking = threadRuntimeIsActive(voiceThread?.runtime);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the dev server's voice config once
  useEffect(() => {
    let cancelled = false;
    fetch("/__t3voice/config")
      .then((response) => (response.ok ? (response.json() as Promise<VoiceConfig>) : null))
      .then((value) => {
        if (!cancelled) setConfig(value);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- polls the local speech service while it is the chosen engine, so the bar says when it is down instead of falling back
  useEffect(() => {
    if (engine !== "local") return;
    let cancelled = false;
    const check = () =>
      fetch("/__t3voice/local/health")
        .then(async (response) => {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          if (!cancelled)
            setLocalProblem(response.ok ? null : (body.error ?? "Local speech is down"));
        })
        .catch(() => {
          if (!cancelled) setLocalProblem("Local speech is down");
        });
    void check();
    const timer = window.setInterval(check, LOCAL_HEALTH_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [engine]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- installs the brain-edited theme file as T3's "Voice" theme
  useEffect(() => syncVoiceTheme(), []);

  const send = useEffectEvent(async (text: string) => {
    if (environmentId === null || project === undefined) {
      setError("No t3code project for this checkout yet; start with scripts/t3voice.sh.");
      return;
    }
    const defaultSelection = serverSettings.defaultModelSelection;
    const modelSelection =
      defaultSelection !== null && config?.model
        ? // Same instance and options (effort) as the default; only the model differs.
          { ...defaultSelection, model: config.model }
        : defaultSelection;
    const createdAt = new Date().toISOString();
    const message = { messageId: newMessageId(), role: "user" as const, attachments: [] };
    const existingThreadId = voiceThread?.id ?? pendingThreadIdRef.current;
    if (existingThreadId === null && modelSelection === null) {
      setError("Pick a default model in Settings first.");
      return;
    }
    const threadId = existingThreadId ?? newThreadId();
    if (existingThreadId === null) pendingThreadIdRef.current = threadId;
    const briefed = existingThreadId === null || needsBrief(threadId, items);
    const turnText = briefed ? withBrief(text) : text;
    const result =
      existingThreadId !== null || modelSelection === null
        ? await startTurn({
            environmentId,
            input: {
              threadId,
              message: { ...message, text: turnText },
              runtimeMode: voiceThread?.runtimeMode ?? "full-access",
              interactionMode: voiceThread?.interactionMode ?? "default",
              createdAt,
            },
          })
        : await startTurn({
            environmentId,
            input: {
              threadId,
              message: { ...message, text: turnText },
              modelSelection,
              runtimeMode: "full-access",
              interactionMode: "default",
              bootstrap: {
                createThread: {
                  projectId: project.id,
                  title: voiceThreadTitle(config),
                  modelSelection,
                  runtimeMode: "full-access",
                  interactionMode: "default",
                  branch: null,
                  worktreePath: null,
                  createdAt,
                },
              },
              createdAt,
            },
          });
    if (result._tag === "Failure") {
      if (existingThreadId === null) pendingThreadIdRef.current = null;
      const failure = squashAtomCommandFailure(result);
      setError(failure instanceof Error ? failure.message : String(failure));
      return;
    }
    if (briefed) markBriefed(threadId);
    voiceLog("tim", "send", { text, briefed, threadId });
    sentAtRef.current = performance.now();
    sentEpochRef.current = Date.now();
    workStartedRef.current = false;
    firstTextLoggedRef.current = false;
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    const checkHold = () => {
      holdTimerRef.current = null;
      const waited = performance.now() - sentAtRef.current;
      if (waited >= HOLD_ANYWAY_MS || (waited >= HOLD_AFTER_MS && workStartedRef.current)) {
        voiceLog("voice", "hold-line", {
          afterMs: Math.round(waited),
          work: workStartedRef.current,
        });
        sessionRef.current?.speak(HOLD_LINE);
        return;
      }
      holdTimerRef.current = window.setTimeout(checkHold, HOLD_CHECK_MS);
    };
    holdTimerRef.current = window.setTimeout(checkHold, HOLD_AFTER_MS);
  });

  const toggle = useEffectEvent(async () => {
    const current = sessionRef.current;
    // While a reply plays, a tap only stops the reply; on a phone its speaker sits next to the mic.
    if (current?.active && phase === "speaking") {
      current.stopSpeaking("tap");
      setStoppedAt(Date.now());
      return;
    }
    if (current?.active) {
      current.stop();
      sessionRef.current = null;
      endVoiceLogSession("mic off (tap)");
      return;
    }
    setError(null);
    const session = new VoiceSession({
      onPhase: (next) => {
        setPhase(next);
        if (next === "hearing") setError(null);
      },
      onUtterance: (text) => void send(text),
      onError: (message) => {
        voiceLog("system", "error", { where: "voice", message });
        setError(message);
      },
      onStopped: () => setStoppedAt(Date.now()),
    });
    startVoiceLogSession({ engine: speechEngine(), thread: voiceThread?.id ?? null });
    sessionRef.current = session;
    sessionStartedAtRef.current = Date.now();
    setStarting(true);
    try {
      await session.start();
    } catch (cause) {
      sessionRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the session while the brain works, so Tim needs a little more to cut in (Presence's think bar)
  useEffect(() => {
    sessionRef.current?.setThinking(thinking);
  }, [thinking]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- speaks the voice thread's replies sentence by sentence as they stream while the mic is on
  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) return;
    for (const { item, visibility } of items) {
      const startedAt = DateTime.toEpochMillis(item.startedAt ?? item.updatedAt);
      const thisTurn = sentEpochRef.current > 0 && startedAt >= sentEpochRef.current - 500;
      if (thisTurn && !TALK_ITEMS.has(item.type)) workStartedRef.current = true;
      if (item.type !== "assistant_message" || visibility !== "local") continue;
      if (item.parentItemId !== null) continue;
      if (startedAt < sessionStartedAtRef.current - 1_000) continue;
      const queued = spokenRef.current.get(item.id) ?? 0;
      if (queued >= item.text.length && item.streaming) continue;
      // Only this turn's reply: the previous turn's finished one is still in the list (eval 2 Nov:
      // first-text read 1 ms after every send).
      if (!firstTextLoggedRef.current && item.text.length > 0 && thisTurn) {
        firstTextLoggedRef.current = true;
        voiceLog("brain", "first-text", {
          msSinceSend: Math.round(performance.now() - sentAtRef.current),
          streaming: item.streaming,
        });
      }
      const { sentences, consumed } = takeSentences(item.text.slice(queued), !item.streaming);
      spokenRef.current.set(item.id, queued + consumed);
      if (sentences.length > 0) {
        if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        // The hold line was queued but has not started: the real line replaces it.
        session.cancelQueued(HOLD_LINE);
      }
      for (const sentence of sentences) {
        voiceLog("brain", "sentence", {
          text: sentence,
          streaming: item.streaming,
          msSinceSend:
            sentAtRef.current > 0 ? Math.round(performance.now() - sentAtRef.current) : null,
        });
        session.speak(sentence);
      }
    }
  }, [items]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- global mic hotkey and teardown
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.ctrlKey && event.altKey && !event.metaKey && event.code === "KeyV") {
        event.preventDefault();
        void toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  if (config === null) return null;

  // ElevenLabs needs the key in the dev server; local speech needs its service up.
  const unavailable =
    engine === "local"
      ? localProblem
      : config.speech
        ? null
        : "ElevenLabs needs scripts/t3voice.sh";
  const message = error ?? unavailable;
  const state: VoiceBarState =
    message !== null
      ? "error"
      : starting
        ? "connecting"
        : phase === "listening" && thinking
          ? "thinking"
          : phase;

  return (
    <VoiceBar
      state={state}
      message={message}
      disabled={engine === "elevenlabs" && !config.speech}
      label={
        phase === "off"
          ? "Start voice (Ctrl+Option+V)"
          : phase === "speaking"
            ? "Stop the reply"
            : "Stop voice (Ctrl+Option+V)"
      }
      onPress={() => void toggle()}
      analysis={() => sessionRef.current?.analysis() ?? null}
      stoppedAt={stoppedAt}
    />
  );
}
