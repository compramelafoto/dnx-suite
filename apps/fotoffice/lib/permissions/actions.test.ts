import { describe, expect, it } from "vitest";
import { CASH_PROJECT_MONEY_ACTION as DESDE_PLANTILLAS } from "@/lib/commission/templates";
import {
  BOOKINGS_CONFIGURE_ACTION,
  CASH_PROJECT_MONEY_ACTION,
  isKnownAction,
  MODULE_ACTIONS,
  RAFFLES_CONDUCT_ACTION,
} from "./actions";

describe("catálogo de acciones sensibles", () => {
  it("Caja, Coberturas, Reservas y Sorteos tienen las suyas", () => {
    expect(MODULE_ACTIONS.cash.map((a) => a.key)).toEqual(["cash.configure", "cash.project_money"]);
    expect(MODULE_ACTIONS.coverages.map((a) => a.key)).toEqual(["coverages.coordinate"]);
    expect(MODULE_ACTIONS.bookings.map((a) => a.key)).toEqual([BOOKINGS_CONFIGURE_ACTION]);
    expect(MODULE_ACTIONS.raffles.map((a) => a.key)).toEqual([RAFFLES_CONDUCT_ACTION]);
    expect(BOOKINGS_CONFIGURE_ACTION).toBe("bookings.configure");
    expect(RAFFLES_CONDUCT_ACTION).toBe("raffles.conduct");
  });
  it("cada acción tiene etiqueta y descripción", () => {
    for (const a of Object.values(MODULE_ACTIONS).flat()) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });
  it("isKnownAction acepta sólo la acción de su módulo", () => {
    expect(isKnownAction("cash", "cash.configure")).toBe(true);
    expect(isKnownAction("cash", "coverages.coordinate")).toBe(false);
    expect(isKnownAction("cash", "inventada")).toBe(false);
    expect(isKnownAction("members", "cash.configure")).toBe(false);
  });
  it("templates.ts reexporta la misma constante", () => {
    expect(DESDE_PLANTILLAS).toBe(CASH_PROJECT_MONEY_ACTION);
  });
});
