import { describe, expect, it } from "vitest";
import {
  ANDREANI_INTEGRATION_KEY,
  WHATSAPP_INTEGRATION_KEY,
  CORREO_ARGENTINO_INTEGRATION_KEY,
  GOOGLE_CALENDAR_INTEGRATION_KEY,
  GOOGLE_CONTACTS_INTEGRATION_KEY,
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

  it("Google Calendar, Contacts, Correo Argentino, Andreani y WhatsApp son las implementadas hoy", () => {
    expect(listAvailableIntegrationKeys()).toEqual([
      GOOGLE_CALENDAR_INTEGRATION_KEY,
      GOOGLE_CONTACTS_INTEGRATION_KEY,
      CORREO_ARGENTINO_INTEGRATION_KEY,
      ANDREANI_INTEGRATION_KEY,
      WHATSAPP_INTEGRATION_KEY,
    ]);
  });

  it("se puede filtrar por proveedor: la pantalla de Google no ofrece Correo ni Andreani", () => {
    const google = listIntegrations({ status: "AVAILABLE", provider: "GOOGLE" }).map((i) => i.key);
    expect(google).toEqual([GOOGLE_CALENDAR_INTEGRATION_KEY, GOOGLE_CONTACTS_INTEGRATION_KEY]);
    expect(google).not.toContain(CORREO_ARGENTINO_INTEGRATION_KEY);
    expect(google).not.toContain(ANDREANI_INTEGRATION_KEY);
  });

  it("Calendar pide permiso de eventos y la necesita el módulo de reservas", () => {
    const calendar = getIntegrationDefinition(GOOGLE_CALENDAR_INTEGRATION_KEY);
    expect(calendar).toBeDefined();
    expect(calendar!.scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(calendar!.requiredByModules).toContain("bookings");
    // La Agenda usa la misma cuenta (calendario propio).
    expect(calendar!.requiredByModules).toContain("agenda");
  });

  it("las integraciones previstas existen en el catálogo pero no se ofrecen", () => {
    const previstas = listIntegrations({ status: "PLANNED" }).map((i) => i.key);
    expect(previstas).toContain("google-classroom");
    expect(previstas).toContain("google-drive");
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
    for (const integration of listIntegrations({ provider: "GOOGLE" })) {
      expect(integration.scopes.length).toBeGreaterThan(0);
    }
  });
});

describe("Google Contacts", () => {
  it("se ofrece de verdad: sin esto el botón Conectar no aparece", () => {
    const contacts = getIntegrationDefinition(GOOGLE_CONTACTS_INTEGRATION_KEY);
    expect(contacts?.status).toBe("AVAILABLE");
    expect(listAvailableIntegrationKeys()).toContain(GOOGLE_CONTACTS_INTEGRATION_KEY);
  });

  it("pide el permiso de contactos y ninguno más", () => {
    // Un permiso que nadie pidió es un permiso que nadie controla. Google además
    // clasifica este scope como sensible: sumar otros complica la verificación.
    const contacts = getIntegrationDefinition(GOOGLE_CONTACTS_INTEGRATION_KEY);
    expect(contacts?.scopes).toEqual(["https://www.googleapis.com/auth/contacts"]);
  });

  it("declara que la usa Socios, para que la pantalla lo muestre", () => {
    const contacts = getIntegrationDefinition(GOOGLE_CONTACTS_INTEGRATION_KEY);
    expect(contacts?.requiredByModules).toContain("members");
  });
});

describe("Correo Argentino", () => {
  it("se ofrece, sin permisos OAuth y sin módulos que la exijan", () => {
    const correo = getIntegrationDefinition(CORREO_ARGENTINO_INTEGRATION_KEY);
    expect(correo?.key).toBe("correo-argentino");
    expect(correo?.provider).toBe("CORREO_ARGENTINO");
    expect(correo?.status).toBe("AVAILABLE");
    expect(correo?.scopes).toEqual([]);
    expect(correo?.requiredByModules).toEqual([]);
  });
});

describe("Andreani", () => {
  it("se ofrece, sin permisos OAuth y sin módulos que la exijan", () => {
    const andreani = getIntegrationDefinition(ANDREANI_INTEGRATION_KEY);
    expect(andreani?.key).toBe("andreani");
    expect(andreani?.provider).toBe("ANDREANI");
    expect(andreani?.status).toBe("AVAILABLE");
    expect(andreani?.scopes).toEqual([]);
    expect(andreani?.requiredByModules).toEqual([]);
  });
});
