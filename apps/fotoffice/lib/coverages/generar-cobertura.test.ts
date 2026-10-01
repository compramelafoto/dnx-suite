import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS, type CoverageSettingsShape } from "./settings";
import {
  datetimeLocalValue,
  planGenerarCobertura,
  rolesConfigurados,
  sugerirCobertura,
  sugerirRoles,
} from "./generar-cobertura";

describe("sugerirCobertura", () => {
  it("copia título, fechas, dirección, ciudad y el punto del mapa", () => {
    const startsAt = new Date("2026-10-03T14:00:00.000Z");
    const endsAt = new Date("2026-10-03T18:00:00.000Z");
    const sugerido = sugerirCobertura({
      eventTitle: "Colecta de invierno",
      startsAt,
      endsAt,
      addressLine: "Av. Siempre Viva 742",
      city: "Springfield",
      latitude: -32.9468,
      longitude: -60.6393,
    });
    expect(sugerido).toEqual({
      title: "Colecta de invierno",
      startsAt,
      endsAt,
      addressLine: "Av. Siempre Viva 742",
      city: "Springfield",
      // El punto viaja con la dirección: copiar una sin el otro dejaría la cobertura con la
      // parte ambigua del dato y sin la que saca la duda.
      latitude: -32.9468,
      longitude: -60.6393,
    });
  });

  it("una solicitud sin punto sugiere una cobertura sin punto, no una a medias", () => {
    const startsAt = new Date("2026-10-03T14:00:00.000Z");
    const endsAt = new Date("2026-10-03T18:00:00.000Z");
    expect(
      sugerirCobertura({
        eventTitle: "Colecta de invierno",
        startsAt,
        endsAt,
        addressLine: "Al lado de la plaza",
        city: "Villa Elisa",
      }),
    ).toMatchObject({ latitude: null, longitude: null });
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

/**
 * La lista de roles que cada institución configura.
 *
 * Existía desde el primer día en la configuración del módulo —"Roles que suelen necesitar, uno
 * por línea"— y no la leía ninguna pantalla: se guardaba en `CoverageSettings.roleTemplates` y
 * ahí moría. Estos casos son la barrera para que no vuelva a pasar.
 */
describe("sugerirRoles con la lista de la institución cargada", () => {
  const conLista = (roleTemplates: string[]): CoverageSettingsShape => ({
    ...DEFAULT_COVERAGE_SETTINGS,
    roleTemplates,
  });

  const corta = {
    requestedPhotographers: 1,
    startsAt: new Date("2026-10-03T10:00:00.000Z"),
    endsAt: new Date("2026-10-03T11:00:00.000Z"),
  };

  it("usa el vocabulario de la organización en vez de las dos constantes", () => {
    expect(sugerirRoles(corta, conLista(["Fotografía", "Video", "Edición"]))).toEqual([
      { name: "Fotografía", vacancies: 1 },
    ]);
  });

  it("dos fotógrafos pedidos son dos vacantes del mismo rol, no «Fotografía» y «Video»", () => {
    // El orden de la lista dice qué necesita más la institución, no qué es el principal y qué
    // el segundo: proponer "Video" porque está segundo sería contestar otra cosa de la que
    // pidió la organización. Los roles distintos los agrega quien coordina.
    expect(
      sugerirRoles({ ...corta, requestedPhotographers: 2 }, conLista(["Fotografía", "Video"])),
    ).toEqual([{ name: "Fotografía", vacancies: 2 }]);
  });

  it("con una jornada larga suma la vacante del refuerzo, con el número configurado", () => {
    const larga = {
      requestedPhotographers: 1,
      startsAt: new Date("2026-10-03T10:00:00.000Z"),
      endsAt: new Date("2026-10-03T14:30:00.000Z"), // 4 h 30, supera el umbral
    };
    expect(sugerirRoles(larga, conLista(["Cobertura de prensa"]))).toEqual([
      { name: "Cobertura de prensa", vacancies: 2 },
    ]);
    expect(
      sugerirRoles(larga, { ...conLista(["Cobertura de prensa"]), recommendedCollaborators: 3 }),
    ).toEqual([{ name: "Cobertura de prensa", vacancies: 3 }]);
  });

  it("una lista con espacios, repetidos y líneas vacías se limpia sola", () => {
    expect(rolesConfigurados(conLista(["  Video  ", "", "video", "Edición", "   "]))).toEqual([
      "Video",
      "Edición",
    ]);
  });

  it("con la lista vacía no cambia nada de lo que ya hacía", () => {
    expect(sugerirRoles(corta, conLista([]))).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
    ]);
    expect(sugerirRoles(corta, conLista(["   ", ""]))).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
    ]);
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

  it("un rol con vacantes que no son un número no es válido", () => {
    // El formulario arma este campo con `Number(...)`, y un texto cualquiera da `NaN`. Como
    // `NaN <= 0` es `false`, sin un control explícito el `NaN` pasaba y le llegaba a Prisma,
    // que corta con un error de sistema en lugar de con un aviso legible.
    const r = planGenerarCobertura({
      solicitud,
      workspaceId: "ws-a",
      roles: [{ name: "Fotógrafo principal", vacancies: Number("no es un número") }],
    });
    expect(r.ok).toBe(false);
  });

  it("basta con que UN rol esté mal para rechazar todo", () => {
    const r = planGenerarCobertura({
      solicitud,
      workspaceId: "ws-a",
      roles: [
        { name: "Fotógrafo principal", vacancies: 1 },
        { name: "Segundo fotógrafo", vacancies: 0 },
      ],
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
