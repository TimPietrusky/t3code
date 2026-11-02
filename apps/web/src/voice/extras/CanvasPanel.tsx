import { useState } from "react";
import { DayRecap } from "./DayRecap";
import { TicketReview } from "./TicketReview";
import "./canvasPanel.css";

const TABS = [
  { key: "tickets", label: "Tickets" },
  { key: "today", label: "Today" },
] as const;

/** One panel at the canvas's top left with a tab per list, so the lists never cover each other on a phone. */
export function CanvasPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("tickets");
  return (
    <section data-t3voice-panel="">
      <nav>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div data-t3voice-panel-body="">{tab === "today" ? <DayRecap /> : <TicketReview />}</div>
    </section>
  );
}
