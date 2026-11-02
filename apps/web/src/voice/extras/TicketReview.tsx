import { useState } from "react";
import { AFTER_CONF_READ, AFTER_CONF_TICKETS, type TicketRec } from "./afterConfTickets";

const RECS: readonly TicketRec[] = ["close", "keep", "ask"];
const COUNTS = RECS.map(
  (rec) => `${AFTER_CONF_TICKETS.filter((ticket) => ticket.rec === rec).length} ${rec}`,
).join(" · ");

/** The "After the conference" tickets, numbered so Tim can say "close 12" or "keep 13"; tap a row for details. */
export function TicketReview() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div data-t3voice-tickets="">
      <p>
        After the conference: {AFTER_CONF_TICKETS.length} open, read {AFTER_CONF_READ}
      </p>
      <p data-t3voice-ticket-counts="">{COUNTS}</p>
      <ol>
        {AFTER_CONF_TICKETS.map((ticket, index) => {
          const expanded = open.has(ticket.id);
          return (
            <li key={ticket.id}>
              <button type="button" aria-expanded={expanded} onClick={() => toggle(ticket.id)}>
                <b>{index + 1}</b>
                <span>
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticket.id} · {ticket.state}
                    {ticket.who ? ` · ${ticket.who}` : ""}
                  </small>
                  {expanded ? (
                    <span data-t3voice-ticket-detail="">
                      <span>{ticket.about}</span>
                      <em>{ticket.why}</em>
                    </span>
                  ) : null}
                </span>
                <i data-rec={ticket.rec}>{ticket.rec}</i>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
