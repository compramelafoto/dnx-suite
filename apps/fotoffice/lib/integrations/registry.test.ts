import { describe, expect, it } from "vitest";
import {
  ALBOOM_CRM_INTEGRATION_KEY,
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

  it("Google Calendar y Alboom CRM son las implementadas hoy", () => {
    expect(listAvailableIntegrationKeys()).toEqual([
      GOOGLE_CALENDAR_INTEGRATION_KEY,
      ALBOOM_CRM_INTEGRATION_KEY,
    ]);
  });

  it("Alboom CRM no es OAuth: sin permisos que otorgar y la necesita el Asistente de ventas", () => {
    const alboom = getIntegrationDefinition(ALBOOM_CRM_INTEGRATION_KEY);
    expect(alboom).toBeDefined();
    expect(alboom!.provider).toBe("ALBOOM");
    expect(alboom!.scopes).toEqual([]);
    expect(alboom!.requiredByModules).toContain("sales-assistant");
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

  it("toda integración de Google declara al menos un permiso", () => {
    // Alboom no es OAuth: queda afuera de esta regla a propósito (ver el test de arriba).
    for (const integration of listIntegrations().filter((i) => i.provider === "GOOGLE")) {
      expect(integration.scopes.length).toBeGreaterThan(0);
    }
  });
});
