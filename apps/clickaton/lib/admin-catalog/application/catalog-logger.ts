import type { CatalogActor } from "../domain/types";

export type CatalogLogAction =
  | "catalog.ticket.created"
  | "catalog.ticket.updated"
  | "catalog.ticket.duplicated"
  | "catalog.ticket.activated"
  | "catalog.ticket.deactivated"
  | "catalog.ticket.composition_replaced"
  | "catalog.product.created"
  | "catalog.product.updated"
  | "catalog.product.activated"
  | "catalog.product.deactivated"
  | "catalog.variant.created"
  | "catalog.variant.updated"
  | "catalog.variant.activated"
  | "catalog.variant.deactivated"
  | "catalog.variant.stock_adjusted";

export type CatalogLogEvent = {
  action: CatalogLogAction;
  actorUserId: number;
  entity: "ticket_type" | "product" | "variant";
  entityId: string;
  editionId?: string;
  requestId?: string | null;
  reason?: string | null;
  changedFields?: string[];
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
};

export type CatalogLogger = {
  emit(event: Omit<CatalogLogEvent, "timestamp" | "actorUserId"> & { actor: CatalogActor }): void;
};

export function createConsoleCatalogLogger(): CatalogLogger {
  return {
    emit({ actor, ...rest }) {
      const payload: CatalogLogEvent = {
        ...rest,
        actorUserId: actor.userId,
        timestamp: new Date().toISOString(),
      };
      // Structured — no secrets / PII beyond actor id
      console.info("[clickaton.catalog]", JSON.stringify(payload));
    },
  };
}

/** Logger en memoria para selfchecks. */
export function createMemoryCatalogLogger(): CatalogLogger & { events: CatalogLogEvent[] } {
  const events: CatalogLogEvent[] = [];
  return {
    events,
    emit({ actor, ...rest }) {
      events.push({
        ...rest,
        actorUserId: actor.userId,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
