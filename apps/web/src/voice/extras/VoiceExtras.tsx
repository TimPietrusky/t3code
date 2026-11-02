import { CanvasPanel } from "./CanvasPanel";
import { VoiceClock } from "./VoiceClock";

/**
 * Voice-made UI, laid over the voice page. This folder builds as its own small bundle that the
 * phone swaps in live (../extras.config.ts), so import only React and files in this folder.
 */
export function VoiceExtras() {
  return (
    <>
      <VoiceClock />
      <CanvasPanel />
    </>
  );
}
