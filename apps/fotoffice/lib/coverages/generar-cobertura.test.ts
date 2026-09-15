import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS, type CoverageSettingsShape } from "./settings";
import {
  datetimeLocalValue,
  planGenerarCobertura,
  sugerirCobertura,
  sugerirRoles,
} from "./generar-cobertura";

describe("sugerirCobertura", () => {
  it("copia título, fechas, dirección y ciudad de la solicitud", () => {
    const startsAt = new Date("2026-10-03T14:00:00.000Z");
    const endsAt = new Date("2026-10-03T18:00:00.000Z");
    const sugerido = sugerirCobertura({
      eventTitle: "Colecta de invierno",
      startsAt,
      endsAt,
      addressLine: "Av. Siempre Viva 742",
      city: "Springfield",
    });
    expect(sugerido).toEqual({
      title: "Colecta de invierno",
      startsAt,
      endsAt,
      addressLine: "Av. Siempre Viva 742",
      city: "Springfield",
    });
  });
});

describe("sugerirRoles", () => {
  const settings: CoverageSettingsShape = DEFAULT_COVERAGE_SETTINGS; // umbral 180 min

  it("con 2 fotógrafos pedidos, propone principal y segundo", () => {
    const roles = sugerirRoles(
      {
        requestedPhotographers: 2,
        startsAt: new Date("2026-10-03T14:00:00.000Z"),
        endsAt: new Date("2026-10-03T15:00:00.000Z"), // corta, no importa acá
      },
      settings,
    );
    expect(roles).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
      { name: "Segundo fotógrafo", vacancies: 1 },
    ]);
  });

  it("con 4 fotógrafos pedidos, el excedente se acumula en el segundo rol", () => {
    const roles = sugerirRoles(
      {
        requestedPhotographers: 4,
        startsAt: new Date("2026-10-03T14:00:00.000Z"),
        endsAt: new Date("2026-10-03T15:00:00.000Z"),
      },
      settings,
    );
    expect(roles).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
      { name: "Segundo fotógrafo", vacancies: 3 },
    ]);
  });

  it("con 1 fotógrafo pedido y una jornada larga, propone igual el refuerzo", () => {
    const roles = sugerirRoles(
      {
        requestedPhotographers: 1,
        startsAt: new Date("2026-10-03T10:00:00.000Z"),
        endsAt: new Date("2026-10-03T14:30:00.000Z"), // 4 h 30, supera el umbral de 180 min
      },
      settings,
    );
    expect(roles).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
      { name: "Segundo fotógrafo", vacancies: 1 },
    ]);
  });

  it("con 1 fotógrafo pedido y una jornada corta, no propone refuerzo", () => {
    const roles = sugerirRoles(
      {
        requestedPhotographers: 1,
        startsAt: new Date("2026-10-03T10:00:00.000Z"),
        endsAt: new Date("2026-10-03T11:00:00.000Z"), // 1 h, no supera el umbral
      },
      settings,
    );
    expect(roles).toEqual([{ name: "Fotógrafo principal", vacancies: 1 }]);
  });

  it("sin dato de fotógrafos pedidos, se asume uno solo", () => {
    const roles = sugerirRoles(
      {
        requestedPhotographers: null,
        startsAt: new Date("2026-10-03T10:00:00.000Z"),
        endsAt: new Date("2026-10-03T11:00:00.000Z"),
      },
      settings,
    );
    expect(roles).toEqual([{ name: "Fotógrafo principal", vacancies: 1 }]);
  });
});

describe("planGenerarCobertura", () => {
  const solicitud = { id: "req-1", workspaceId: "ws-a", status: "APROBADA" };
  const roles = [{ name: "Fotógrafo principal", vacancies: 1 }];

  it("una solicitud de otro workspace no existe para esta persona", () => {
    const r = planGenerarCobertura({ solicitud: null, workspaceId: "ws-a", roles });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No encontramos");
  });

  it("una solicitud que no es de este workspace tampoco existe", () => {
    const r = planGenerarCobertura({
      solicitud: { ...solicitud, workspaceId: "ws-b" },
      workspaceId: "ws-a",
      roles,
    });
    expect(r.ok).toBe(false);
  });

  it("no se puede generar desde una solicitud que no está aprobada", () => {
    const r = planGenerarCobertura({
      solicitud: { ...solicitud, status: "EN_EVALUACION" },
      workspaceId: "ws-a",
      roles,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("aprobada");
  });

  it("sin roles, no hay nada que crear", () => {
    const r = planGenerarCobertura({ solicitud, workspaceId: "ws-a", roles: [] });
    expect(r.ok).toBe(false);
  });

  it("un rol sin nombre no es válido", () => {
    const r = planGenerarCobertura({
      solicitud,
      workspaceId: "ws-a",
      roles: [{ name: "  ", vacancies: 1 }],
    });
    expect(r.ok).toBe(false);
  });

  it("un rol con cero vacantes no es válido", () => {
    const r = planGenerarCobertura({
      solicitud,
      workspaceId: "ws-a",
      roles: [{ name: "Fotógrafo principal", vacancies: 0 }],
    });
    expect(r.ok).toBe(false);
  });

  it("camino feliz: solicitud aprobada, de este workspace, con roles válidos", () => {
    const r = planGenerarCobertura({ solicitud, workspaceId: "ws-a", roles });
    expect(r).toEqual({ ok: true });
  });
});

describe("datetimeLocalValue", () => {
  it("da los componentes de fecha y hora sin segundos, sin convertir de zona", () => {
    expect(datetimeLocalValue(new Date("2026-10-03T14:05:00.000Z"))).toBe("2026-10-03T14:05");
  });
});
