import { createFileRoute } from "@tanstack/react-router";

import { CanvasPage } from "../voice/CanvasPage";
import { setVoiceOpen } from "../voice/voiceOpen";

export const Route = createFileRoute("/_chat/canvas")({
  component: CanvasPage,
  onEnter: () => setVoiceOpen(true),
});
