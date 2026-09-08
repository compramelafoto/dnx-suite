import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_INTEGRATION_KEY,
  findDuplicateIntegrationKeys,
  getIntegrationDefinition,
  integrationsRequiredByModule,
  listAvailableIntegrationKeys,
  listIntegrations,
} from "./registry";

describe("catálogo de integraciones", () => {
  it("ninguna clave se repite", () => {
    expect(findDuplicateIntegrationKeys()).toEqual([]);
  });

  it("Google Calendar es la única implementada hoy", () => {
    expect(listAvailableIntegrationKeys()).toEqual([GOOGLE_CALENDAR_INTEGRATION_KEY]);
  });

  it("Calendar pide permiso de eventos y la necesita el módulo de reservas", () => {
    const calendar = getIntegrationDefinition(GOOGLE_CALENDAR_INTEGRATION_KEY);
    expect(calendar).toBeDefined();
    expect(calendar!.scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(calendar!.requiredByModules).toContain("bookings");
  });

  it("las integraciones previstas existen en el catálogo pero no se ofrecen", () => {
    const previstas = listIntegrations({ status: "PLANNED" }).map((i) => i.key);
    expect(previstas).toContain("google-classroom");
    expect(previstas).toContain("google-drive");
    expect(previstas).toContain("google-contacts");
    for (const key of previstas) {
      expect(listAvailableIntegrationKeys()).not.toContain(key);
    }
  });

  it("se puede preguntar qué integraciones necesita un módulo", () => {
    expect(integrationsRequiredByModule("bookings").map((i) => i.key)).toEqual([
      GOOGLE_CALENDAR_INTEGRATION_KEY,
    ]);
    expect(integrationsRequiredByModule("members-inexistente")).toEqual([]);
  });

  it("toda integración declara al menos un permiso", () => {
    for (const integration of listIntegrations()) {
      expect(integration.scopes.length).toBeGreaterThan(0);
    }
  });
});
