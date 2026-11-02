import { createFileRoute } from "@tanstack/react-router";

import { VoicePage } from "../voice/VoicePage";
import { setVoiceOpen } from "../voice/voiceOpen";

export const Route = createFileRoute("/_chat/voice")({
  component: VoicePage,
  onEnter: () => setVoiceOpen(true),
});
