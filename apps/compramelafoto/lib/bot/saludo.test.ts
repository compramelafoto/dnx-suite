import { describe, expect, it } from "vitest";
import { saludoPorHora } from "./saludo";

// Argentina = UTC-3
describe("saludoPorHora", () => {
  it.each([
    ["2026-10-12T07:59:00Z", "Buenas noches"], // 04:59
    ["2026-10-12T08:00:00Z", "Buen día"], // 05:00
    ["2026-10-12T15:59:00Z", "Buen día"], // 12:59
    ["2026-10-12T16:00:00Z", "Buenas tardes"], // 13:00
    ["2026-10-12T22:59:00Z", "Buenas tardes"], // 19:59
    ["2026-10-12T23:00:00Z", "Buenas noches"], // 20:00
  ])("%s -> %s", (iso, esperado) => {
    expect(saludoPorHora(new Date(iso))).toBe(esperado);
  });
});
