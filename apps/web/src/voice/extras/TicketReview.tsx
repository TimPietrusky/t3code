import { useState } from "react";
import { Hidden } from "./streamer";
import { AFTER_CONF_READ, AFTER_CONF_TICKETS, type TicketRec } from "./afterConfTickets";

type Decision = "keep" | "close";
type Decided = Readonly<Record<string, Decision>>;

const STORE = "t3voice:afterconf-decisions";
const RECS: readonly TicketRec[] = ["close", "keep", "ask"];
const COUNTS = RECS.map(
  (rec) => `${AFTER_CONF_TICKETS.filter((ticket) => ticket.rec === rec).length} ${rec}`,
).join(" · ");

function readDecided(): Decided {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Decided;
  } catch {
    return {};
  }
}

// Into the voice session log (/__t3voice/log), where the voice brain reads Tim's decisions.
function logDecision(id: string, decision: Decision | "undo") {
  const title = AFTER_CONF_TICKETS.find((ticket) => ticket.id === id)?.title;
  const event = {
    t: new Date().toISOString(),
    who: "tim",
    type: "ticket.decision",
    id,
    decision,
    title,
  };
  void fetch("/__t3voice/log", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify([event]),
    cache: "no-store",
  }).catch(() => undefined);
}

/** The "After the conference" tickets: tap a row for details, Keep or Close takes it off the list. */
export function TicketReview() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [decided, setDecided] = useState<Decided>(readDecided);
  const [order, setOrder] = useState<readonly string[]>(() => Object.keys(readDecided()));

  const save = (next: Decided) => {
    setDecided(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  };
  const decide = (id: string, decision: Decision) => {
    save({ ...decided, [id]: decision });
    setOrder([...order.filter((other) => other !== id), id]);
    logDecision(id, decision);
  };
  const undo = () => {
    const last = order.at(-1);
    if (!last) return;
    const { [last]: _dropped, ...rest } = decided;
    save(rest);
    setOrder(order.slice(0, -1));
    logDecision(last, "undo");
  };
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const values = Object.values(decided);
  const kept = values.filter((decision) => decision === "keep").length;
  const closed = values.length - kept;

  return (
    <div data-t3voice-tickets="">
      <p>
        After the conference: {AFTER_CONF_TICKETS.length} open, read {AFTER_CONF_READ}
      </p>
      <p data-t3voice-ticket-counts="">
        Recommended {COUNTS}
        {values.length > 0 ? (
          <>
            {" "}
            · you: {kept} keep, {closed} close{" "}
            <button type="button" data-t3voice-ticket-undo="" onClick={undo}>
              undo
            </button>
          </>
        ) : null}
      </p>
      <ol>
        {AFTER_CONF_TICKETS.map((ticket, index) => {
          if (decided[ticket.id]) return null;
          const expanded = open.has(ticket.id);
          return (
            <li key={ticket.id}>
              <button type="button" aria-expanded={expanded} onClick={() => toggle(ticket.id)}>
                <b>{index + 1}</b>
                <span>
                  <strong>
                    <Hidden text={ticket.title} />
                  </strong>
                  <small>
                    {ticket.id} · {ticket.state}
                    {ticket.who ? (
                      <>
                        {" · "}
                        <Hidden text={ticket.who} />
                      </>
                    ) : null}
                  </small>
                  {expanded ? (
                    <span data-t3voice-ticket-detail="">
                      <span>
                        <Hidden text={ticket.about} />
                      </span>
                      <em>
                        <Hidden text={ticket.why} />
                      </em>
                    </span>
                  ) : null}
                </span>
              </button>
              <span data-t3voice-ticket-actions="">
                {(["keep", "close"] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    data-decision={decision}
                    data-recommended={ticket.rec === decision ? "" : undefined}
                    onClick={() => decide(ticket.id, decision)}
                  >
                    {decision}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
