import { createFileRoute } from "@tanstack/react-router";

import { VoicePage } from "../voice/VoicePage";

function VoiceRouteView() {
  const { authGateState } = Route.useRouteContext();
  return <VoicePage authenticated={authGateState.status === "authenticated"} />;
}

export const Route = createFileRoute("/_chat/voice")({
  component: VoiceRouteView,
});
