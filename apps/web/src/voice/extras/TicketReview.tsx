import { AFTER_CONF_READ, AFTER_CONF_TICKETS } from "./afterConfTickets";

/** The "After the conference" tickets, numbered so Tim can say "close 12" or "keep 13". */
export function TicketReview() {
  return (
    <div data-t3voice-tickets="">
      <p>
        After the conference: {AFTER_CONF_TICKETS.length} open, read {AFTER_CONF_READ}
      </p>
      <ol>
        {AFTER_CONF_TICKETS.map((ticket, index) => (
          <li key={ticket.id}>
            <b>{index + 1}</b>
            <span>
              <strong>{ticket.title}</strong>
              <small>
                {ticket.id} · {ticket.state}
                {ticket.who ? ` · ${ticket.who}` : ""}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
