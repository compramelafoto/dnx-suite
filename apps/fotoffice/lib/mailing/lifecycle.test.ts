import { describe, expect, it } from "vitest";
import { buildOccasionEmail, daysBefore, eventDay, inactiveForDays, joinedDaysAgo, leftDaysAgo, type LifecycleMember } from "./occasions";
import { OCCASION_CATALOG, mergeOccasions, topicForOccasion } from "./occasions-catalog";

const socio = (over: Partial<LifecycleMember>): LifecycleMember => ({
  id: "x",
  email: "x@mail.com",
  firstName: "X",
  status: "ACTIVE",
  joinedAt: new Date("2020-01-01T00:00:00Z"),
  leftAt: null,
  leftReason: null,
  lastLoginAt: null,
  ...over,
});
const hoy = { y: 2026, m: 10, d: 12 };

describe("fechas del ciclo", () => {
  it("fecha cargada a mano se lee en UTC; con hora, en Argentina", () => {
    expect(eventDay(new Date("2026-10-05T00:00:00Z"))).toEqual({ y: 2026, m: 10, d: 5 });
    // Alta aprobada el 5/10 a las 22 h argentinas = 6/10 01:00 UTC.
    expect(eventDay(new Date("2026-10-06T01:00:00Z"))).toEqual({ y: 2026, m: 10, d: 5 });
    expect(daysBefore({ y: 2026, m: 3, d: 1 }, 1)).toEqual({ y: 2026, m: 2, d: 28 });
  });
});

describe("a quién le toca", () => {
  it("bienvenida: activos que entraron hace N días", () => {
    const lista = [
      socio({ id: "a", joinedAt: new Date("2026-10-05T00:00:00Z") }),
      socio({ id: "b", joinedAt: new Date("2026-10-06T01:00:00Z") }), // 5/10 en Argentina
      socio({ id: "c", joinedAt: new Date("2026-10-04T00:00:00Z") }),
      socio({ id: "d", joinedAt: new Date("2026-10-05T00:00:00Z"), status: "INACTIVE" }),
    ];
    expect(joinedDaysAgo(lista, hoy, 7).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("ex socios: hace N días, nunca por sanción", () => {
    const baja = new Date("2026-08-13T00:00:00Z");
    const lista = [
      socio({ id: "deuda", status: "INACTIVE", leftAt: baja, leftReason: "DEUDA" }),
      socio({ id: "renuncia", status: "INACTIVE", leftAt: baja, leftReason: "RENUNCIA" }),
      socio({ id: "sin-motivo", status: "INACTIVE", leftAt: baja }),
      socio({ id: "sancion", status: "INACTIVE", leftAt: baja, leftReason: "SANCION" }),
      socio({ id: "activo", status: "ACTIVE", leftAt: baja }),
      socio({ id: "otro-dia", status: "INACTIVE", leftAt: new Date("2026-08-14T00:00:00Z") }),
    ];
    expect(leftDaysAgo(lista, hoy, 60).map((m) => m.id)).toEqual(["deuda", "renuncia", "sin-motivo"]);
  });

  it("sin entrar al portal: con cuenta, N días o más, sin aviso reciente", () => {
    const now = new Date("2026-10-12T15:00:00Z");
    const viejo = new Date("2026-08-01T00:00:00Z");
    const lista = [
      socio({ id: "a", email: "A@mail.com", lastLoginAt: viejo }),
      socio({ id: "b", email: "b@mail.com", lastLoginAt: viejo }),
      socio({ id: "c", email: "c@mail.com", lastLoginAt: new Date("2026-10-01T00:00:00Z") }),
      socio({ id: "d", email: "d@mail.com", lastLoginAt: null }),
      socio({ id: "e", email: "e@mail.com", lastLoginAt: viejo, status: "INACTIVE" }),
    ];
    expect(inactiveForDays(lista, now, 60, new Set(["b@mail.com"])).map((m) => m.id)).toEqual(["a"]);
  });
});

describe("catálogo y correo del ciclo", () => {
  it("cuatro correos, apagados, con días y botón; tema novedades", () => {
    const ciclo = OCCASION_CATALOG.filter((o) => o.kind === "LIFECYCLE");
    expect(ciclo.map((o) => o.key)).toEqual(["bienvenida-semana", "bienvenida-mes", "sin-portal", "ex-socio"]);
    expect(ciclo.every((o) => !o.enabled && o.offsetDays && o.cta)).toBe(true);
    expect(topicForOccasion("LIFECYCLE")).toBe("novedades");
  });

  it("lo guardado cambia los días pero no el botón", () => {
    const base = OCCASION_CATALOG.find((o) => o.key === "ex-socio")!;
    const ex = mergeOccasions([{ ...base, offsetDays: 90, enabled: true }]).find((o) => o.key === "ex-socio")!;
    expect(ex.offsetDays).toBe(90);
    expect(ex.cta?.target).toBe("sitio");
  });

  it("el botón sale sólo con dirección https", () => {
    const occasion = OCCASION_CATALOG.find((o) => o.key === "bienvenida-semana")!;
    const base = {
      brand: { name: "SFPR", logoUrl: null, accentColor: null },
      occasion,
      vars: { nombre: "Ana", institucion: "SFPR" },
      signature: null,
      footer: { reason: "r", unsubscribeUrl: "https://f.com/b" },
    };
    const con = buildOccasionEmail({ ...base, cta: { label: "Entrar al portal", url: "https://fotoffice.com/portal" } });
    expect(con.html).toContain("https://fotoffice.com/portal");
    expect(con.text).toContain("Entrar al portal: https://fotoffice.com/portal");
    const sin = buildOccasionEmail({ ...base, cta: { label: "Entrar al portal", url: null } });
    expect(sin.html).not.toContain("Entrar al portal");
  });
});
