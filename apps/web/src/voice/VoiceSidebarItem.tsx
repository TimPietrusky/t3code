import { useLocation, useNavigate } from "@tanstack/react-router";
import { PresentationIcon } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "../components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { voiceEnabled } from "./voiceOpen";

/** Opens the canvas (voice-made UI and the bar) from the sidebar footer. */
export function VoiceSidebarItem() {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = useLocation({ select: (location) => location.pathname === "/canvas" });
  if (!voiceEnabled) return null;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Canvas"
              isActive={active}
              size="icon"
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                void navigate({ to: "/canvas" });
              }}
            >
              <PresentationIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">Canvas</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
