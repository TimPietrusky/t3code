import { MicIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { setVoiceOpen, useVoiceOpen, voiceEnabled } from "./voiceOpen";

/** Shows or hides the voice bar on any view; hiding it ends the call. Sits by the sidebar trigger. */
export function VoiceToggleButton({ onBackdrop }: { readonly onBackdrop: boolean }) {
  const open = useVoiceOpen();
  if (!voiceEnabled) return null;
  const label = open ? "Hide voice" : "Show voice";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={open}
            className={cn(
              "pointer-events-auto [-webkit-app-region:no-drag]",
              onBackdrop && "relative top-auto translate-y-0",
            )}
            data-pressed={open ? "" : undefined}
            onClick={() => setVoiceOpen(!open)}
            size="icon-sm"
            variant={onBackdrop ? "media-navigation" : "ghost"}
          />
        }
      >
        <MicIcon className="size-4" />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}
