import { useLocation, useNavigate } from "@tanstack/react-router";
import { MicIcon } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "../components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { voiceEnabled } from "./voiceOpen";

/** Opens the voice page (voice-made UI and the bar) from the sidebar footer. */
export function VoiceSidebarItem() {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = useLocation({ select: (location) => location.pathname === "/voice" });
  if (!voiceEnabled) return null;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Voice"
              isActive={active}
              size="icon"
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                void navigate({ to: "/voice" });
              }}
            >
              <MicIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">Voice</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
