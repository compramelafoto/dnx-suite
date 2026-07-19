/**
 * Selfcheck de diseño 10D3A — catálogo admin (sin I/O a DB).
 */
import {
  CATALOG_USE_CASES,
  DEFERRED_COMPOSITION_FEATURES,
  MONEY_DISPLAY,
  MVP_COMPOSITION_FEATURES,
  conceptualAvailable,
  conceptualVariantStock,
} from "./contracts";
import {
  CATALOG_PERMISSION_NOTES,
  MVP_CATALOG_ROLE,
  roleHasCatalogCapability,
} from "./permissions";
import { CATALOG_ROUTE_ARCHITECTURE, catalogAdminRoutes } from "./routes";
import { CATALOG_TEST_MATRIX } from "./test-matrix";
import { TICKET_FIELD_GATES, TICKET_TYPE_RULES } from "./validation-rules";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.design.selfcheck: ${msg}`);
}

function main() {
  assert(CATALOG_ROUTE_ARCHITECTURE.primary === "TOP_LEVEL_FILTERED_BY_EDITION", "route arch");
  assert(catalogAdminRoutes.tickets.startsWith("/admin/catalogo"), "tickets route");
  assert(MONEY_DISPLAY.forbidFloat === true, "no float money");
  assert(MONEY_DISPLAY.example.includes("ARS"), "currency in display");
  assert(TICKET_TYPE_RULES.priceAmount.forbidFloat === true, "ticket price int");
  assert(TICKET_FIELD_GATES.priceAmount?.confirmed === "block", "price locked after confirm");
  assert(TICKET_FIELD_GATES.composition?.confirmed === "block", "composition locked after confirm");
  assert(
    !(DEFERRED_COMPOSITION_FEATURES as readonly string[]).includes("included_product"),
    "mvp vs deferred",
  );
  assert(MVP_COMPOSITION_FEATURES.includes("participant_variant_choice"), "variant choice mvp");
  assert(CATALOG_USE_CASES.includes("replaceTicketTypeItems"), "composition use case");
  assert(CATALOG_USE_CASES.includes("getCatalogAvailability"), "availability use case");
  assert(roleHasCatalogCapability(MVP_CATALOG_ROLE, "catalog.ticket.mutate"), "admin can mutate");
  assert(
    !roleHasCatalogCapability("VENUE_ADMIN_FUTURE", "catalog.ticket.mutate"),
    "venue admin cannot mutate tickets",
  );
  assert(CATALOG_PERMISSION_NOTES.noSilentExpansion.length > 0, "permission notes");

  const avail = conceptualAvailable({
    capacity: 100,
    confirmedCount: 40,
    activeHoldCount: 10,
  });
  assert(avail.available === 50, "availability formula");
  assert(
    conceptualAvailable({ capacity: null, confirmedCount: 1, activeHoldCount: 0 }).isUnlimited,
    "unlimited capacity",
  );

  const stock = conceptualVariantStock(10, 3);
  assert(stock.availableStock === 7, "stock available");

  assert(CATALOG_TEST_MATRIX.some((t) => t.id === "D10"), "float rejection test");
  assert(CATALOG_TEST_MATRIX.some((t) => t.layer === "security"), "security tests");

  console.log("clickaton admin-catalog design.selfcheck: ok");
}

main();
