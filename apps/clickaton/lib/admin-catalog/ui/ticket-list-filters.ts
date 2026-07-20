import type { AvailabilityRecord, TicketTypeRecord } from "../domain/types";
import { evaluateTicketConfiguration, type TicketConfigStatus } from "./ticket-status";
import { salesStatusOf } from "../domain/availability";

export type TicketListUiFilters = {
  capacity?: "with" | "without" | "unlimited";
  products?: "with" | "without";
  sale?: "future" | "open" | "ended" | "none";
  config?: "complete" | "incomplete" | "warnings";
};

export type TicketListRow = {
  ticket: TicketTypeRecord;
  availability: AvailabilityRecord | null;
  config: TicketConfigStatus;
};

export function enrichAndFilterTickets(
  tickets: TicketTypeRecord[],
  availabilityById: Map<string, AvailabilityRecord>,
  ui: TicketListUiFilters,
  now = new Date(),
): TicketListRow[] {
  return tickets
    .map((ticket) => {
      const availability = availabilityById.get(ticket.id) ?? null;
      const config = evaluateTicketConfiguration(ticket).status;
      return { ticket, availability, config };
    })
    .filter((row) => {
      if (ui.products === "with" && row.ticket.items.length === 0) return false;
      if (ui.products === "without" && row.ticket.items.length > 0) return false;

      if (ui.capacity === "unlimited" && row.ticket.capacity !== null) return false;
      if (ui.capacity === "with" && (row.ticket.capacity === null || row.ticket.capacity < 1)) {
        return false;
      }
      if (ui.capacity === "without" && row.ticket.capacity !== null) return false;

      const sales =
        row.availability?.salesStatus ??
        salesStatusOf({
          isActive: row.ticket.isActive,
          salesStartAt: row.ticket.salesStartAt,
          salesEndAt: row.ticket.salesEndAt,
          now,
        });
      if (ui.sale === "none" && (row.ticket.salesStartAt || row.ticket.salesEndAt)) return false;
      if (ui.sale === "future" && sales !== "not_started") return false;
      if (ui.sale === "open" && sales !== "open") return false;
      if (ui.sale === "ended" && sales !== "ended") return false;

      if (ui.config === "complete" && row.config !== "complete") return false;
      if (ui.config === "incomplete" && row.config !== "incomplete") return false;
      if (ui.config === "warnings" && row.config !== "warnings") return false;

      return true;
    });
}
