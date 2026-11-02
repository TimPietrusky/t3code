import { Hidden } from "./streamer";
import "./dayRecap.css";

type Entry = { readonly title: string; readonly detail: string; readonly state: "done" | "doing" };

// Kept by the voice brain from the day's threads; one line per thing that matters to the product.
const DAY = "Mon 2 Nov";
const ENTRIES: readonly Entry[] = [
  {
    title: "Grown-up chat",
    detail:
      "Planned, 26 decisions answered, 20 build tickets; a team of 15 agents is building it now",
    state: "doing",
  },
  {
    title: "SMS chat removed",
    detail: "Grown-up SMS chat and web chat gone; codes and urgent alert texts stay",
    state: "done",
  },
  {
    title: "Draw Me removal",
    detail: "Mapped; waiting on which part to remove",
    state: "doing",
  },
  {
    title: "Weekend list closed",
    detail: "All 68 beta lead answers given and carried out: Linear, email, keys, cost caps",
    state: "done",
  },
  {
    title: "Urgent alerts",
    detail: "Surge delivery and signature checks fixed; offline alert lines use our own voice",
    state: "done",
  },
  {
    title: "Release train",
    detail: "Develop to rc to staging to main shipped",
    state: "done",
  },
  {
    title: "Mind maze",
    detail: "Hidden under 10 rooms, no repeated quiz questions",
    state: "done",
  },
  {
    title: "Safety",
    detail: "Own safety model step 1, reading mic words checked, booth take-back deletes kid data",
    state: "done",
  },
  {
    title: "GPUs and costs",
    detail: "Image generation capped, voice keeps GPUs ready, billing and log alerts tuned",
    state: "done",
  },
  {
    title: "App pictures",
    detail: "Redo test batch made and handed to Gabe",
    state: "done",
  },
  {
    title: "Voice in T3",
    detail: "Own canvas page, mic on every screen, local speech, iPhone attachments fixed",
    state: "done",
  },
];

/** The day's high-level work, for the product daily. */
export function DayRecap() {
  return (
    <div data-t3voice-recap="">
      <header>
        <span>Today</span>
        <span>{DAY}</span>
      </header>
      <ol>
        {ENTRIES.map((entry) => (
          <li key={entry.title} data-state={entry.state}>
            <strong>
              <Hidden text={entry.title} />
            </strong>
            <span>
              <Hidden text={entry.detail} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
