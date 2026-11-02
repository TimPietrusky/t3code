import { SidebarInset } from "../components/ui/sidebar";
import { VoiceExtrasSlot } from "./VoiceExtrasSlot";

/** The voice page (/voice): voice-made UI; the bar itself docks over every view (VoiceDock). */
export function VoicePage() {
  return (
    <SidebarInset data-t3voice-page="" className="h-dvh min-h-0 overflow-hidden">
      <VoiceExtrasSlot />
    </SidebarInset>
  );
}
