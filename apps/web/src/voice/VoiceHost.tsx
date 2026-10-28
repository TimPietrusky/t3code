import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/models";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { MicIcon, MicOffIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { newMessageId, newThreadId } from "~/lib/utils";
import { useProjects, useThreadShells, useThreadVisibleTurnItems } from "../state/entities";
import { usePrimaryEnvironmentId } from "../state/environments";
import { primaryServerSettingsAtom } from "../state/server";
import { threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { Button } from "../components/ui/button";
import brainBrief from "./brain.md?raw";
import { type VoicePhase, VoiceSession } from "./speech";
import { VoiceExtras } from "./VoiceExtras";
import { paintVoiceTheme } from "./paintVoiceTheme";

const VOICE_THREAD_TITLE = "voice";

type VoiceConfig = {
  readonly speech: boolean;
  readonly workspaceRoot: string;
  /** T3VOICE_MODEL: a model for new voice threads instead of the default model's. */
  readonly model: string | null;
};

const PHASE_LABEL: Record<VoicePhase, string> = {
  off: "",
  listening: "Listening",
  hearing: "Hearing you",
  transcribing: "Got it",
  speaking: "Speaking",
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
  const sessionRef = useRef<VoiceSession | null>(null);
  const sessionStartedAtRef = useRef(0);
  const spokenRef = useRef(new Set<string>());
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
        shell.title === VOICE_THREAD_TITLE &&
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

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the brain-edited theme file over the selected theme
  useEffect(() => paintVoiceTheme(), []);

  const send = useEffectEvent(async (text: string) => {
    if (environmentId === null || project === undefined) {
      setError("No t3code project for this checkout yet; start with scripts/t3voice.sh.");
      return;
    }
    const defaultSelection = serverSettings.defaultModelSelection;
    const modelSelection =
      defaultSelection !== null && config?.model
        ? { instanceId: defaultSelection.instanceId, model: config.model }
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
    const result =
      existingThreadId !== null || modelSelection === null
        ? await startTurn({
            environmentId,
            input: {
              threadId,
              message: { ...message, text },
              runtimeMode: voiceThread?.runtimeMode ?? "full-access",
              interactionMode: voiceThread?.interactionMode ?? "default",
              createdAt,
            },
          })
        : await startTurn({
            environmentId,
            input: {
              threadId,
              message: { ...message, text: `${brainBrief}\n---\n\nTim says: ${text}` },
              modelSelection,
              runtimeMode: "full-access",
              interactionMode: "default",
              bootstrap: {
                createThread: {
                  projectId: project.id,
                  title: VOICE_THREAD_TITLE,
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
    }
  });

  const toggle = useEffectEvent(async () => {
    const current = sessionRef.current;
    if (current?.active) {
      current.stop();
      sessionRef.current = null;
      return;
    }
    setError(null);
    const session = new VoiceSession({
      onPhase: (next) => {
        setPhase(next);
        if (next === "hearing") setError(null);
      },
      onUtterance: (text) => void send(text),
      onError: setError,
    });
    sessionRef.current = session;
    sessionStartedAtRef.current = Date.now();
    try {
      await session.start();
    } catch (cause) {
      sessionRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- speaks each reply the voice thread finishes while the mic is on
  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) return;
    for (const { item, visibility } of items) {
      if (item.type !== "assistant_message" || item.streaming || visibility !== "local") continue;
      if (item.parentItemId !== null || item.completedAt === null) continue;
      if (spokenRef.current.has(item.id)) continue;
      if (DateTime.toEpochMillis(item.completedAt) < sessionStartedAtRef.current - 1_000) continue;
      spokenRef.current.add(item.id);
      session.speak(item.text);
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

  if (config === null) return <VoiceExtras />;

  const label =
    error ??
    (!config.speech
      ? "Voice needs scripts/t3voice.sh"
      : phase === "listening" && thinking
        ? "Thinking"
        : PHASE_LABEL[phase]);

  return (
    <>
      <VoiceExtras />
      <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex items-center gap-2">
        {label ? (
          <span className="max-w-72 truncate rounded-full border bg-popover px-2.5 py-1 text-xs text-muted-foreground shadow-xs">
            {label}
          </span>
        ) : null}
        <div className="pointer-events-auto">
          <Button
            variant={phase === "off" ? "outline" : "default"}
            size="icon-lg"
            aria-label={phase === "off" ? "Start voice (Ctrl+Option+V)" : "Stop voice"}
            title={phase === "off" ? "Talk to T3 (Ctrl+Option+V)" : "Stop voice (Ctrl+Option+V)"}
            disabled={!config.speech}
            onClick={() => void toggle()}
          >
            {phase === "off" ? <MicOffIcon /> : <MicIcon />}
          </Button>
        </div>
      </div>
    </>
  );
}
