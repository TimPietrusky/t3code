import { useLocation, useNavigate } from "@tanstack/react-router";
import { MicIcon } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "../components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";

/** Opens the voice page from the sidebar footer, next to Settings and Usage. */
export function VoiceSidebarItem() {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = useLocation({ select: (location) => location.pathname === "/voice" });
  // Inline, not VoicePage's constant: importing the page would pull the whole call into the sidebar.
  if (!(import.meta.env.DEV || import.meta.env.VITE_T3VOICE === "1")) return null;
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
