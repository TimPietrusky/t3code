import { createFileRoute, redirect } from "@tanstack/react-router";

// The canvas lived at /voice first; old links and open tabs land there.
export const Route = createFileRoute("/_chat/voice")({
  beforeLoad: () => {
    throw redirect({ to: "/canvas", replace: true });
  },
});
