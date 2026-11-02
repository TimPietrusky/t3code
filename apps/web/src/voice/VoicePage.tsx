import { SidebarInset } from "../components/ui/sidebar";
import { VoiceExtrasSlot } from "./VoiceExtrasSlot";
import { VoiceHost } from "./VoiceHost";

// t3 voice runs on dev, or the phone build (VITE_T3VOICE=1, scripts/t3voice-phone-build.mjs).
const voiceEnabled = import.meta.env.DEV || import.meta.env.VITE_T3VOICE === "1";

/** The voice page (/voice): the call and voice-made UI, nothing else; the sidebar stays. */
export function VoicePage({ authenticated }: { readonly authenticated: boolean }) {
  return (
    <SidebarInset data-t3voice-page="" className="h-dvh min-h-0 overflow-hidden">
      {voiceEnabled && authenticated ? <VoiceHost /> : null}
      <VoiceExtrasSlot />
    </SidebarInset>
  );
}
