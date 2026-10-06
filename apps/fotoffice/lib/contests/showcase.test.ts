import { describe, expect, it } from "vitest";
import {
  bannerItems,
  clickatonPhase,
  ctaLabel,
  daysLeft,
  deadlineLine,
  fotorankPhase,
  sortShowcase,
  withTracking,
  type ShowcaseItem,
} from "./showcase";

const ahora = new Date("2026-10-06T15:00:00Z");
const enDias = (d: number) => new Date(ahora.getTime() + d * 24 * 60 * 60 * 1000);
const item = (p: Partial<ShowcaseItem>): ShowcaseItem => ({
  key: "k",
  source: "fotorank",
  title: "t",
  organizer: "o",
  summary: null,
  coverUrl: null,
  closesAt: null,
  startsAt: null,
  announcedAt: null,
  phase: "open",
  url: "https://fotorank.com/concursos/x",
  own: false,
  ...p,
});

describe("fases", () => {
  it("FotoRank", () => {
    expect(fotorankPhase("PUBLISHED", enDias(5), ahora)).toBe("open");
    expect(fotorankPhase("PUBLISHED", enDias(-1), ahora)).toBe("in_progress");
    expect(fotorankPhase("UPCOMING", null, ahora)).toBe("upcoming");
    expect(fotorankPhase("JUDGING", null, ahora)).toBe("in_progress");
    expect(fotorankPhase("COMPLETED", null, ahora)).toBe("results");
    expect(fotorankPhase("DRAFT", null, ahora)).toBeNull();
    expect(fotorankPhase("CANCELLED", null, ahora)).toBeNull();
  });

  it("Clickatón", () => {
    expect(clickatonPhase("open", "registration_open")).toBe("open");
    expect(clickatonPhase("last_places", "registration_open")).toBe("open");
    expect(clickatonPhase("coming_soon", "announced")).toBe("upcoming");
    expect(clickatonPhase("closed", "in_progress")).toBe("in_progress");
    expect(clickatonPhase("open", "cancelled")).toBeNull();
  });
});

describe("orden", () => {
  it("lo propio primero, después abiertos por cierre, próximos, en curso y resultados", () => {
    const r = sortShowcase([
      item({ key: "resultados", phase: "results" }),
      item({ key: "abierto-lejos", closesAt: enDias(30) }),
      item({ key: "propio", own: true, closesAt: enDias(60) }),
      item({ key: "abierto-cerca", closesAt: enDias(3) }),
      item({ key: "proximo", phase: "upcoming" }),
      item({ key: "curso", phase: "in_progress" }),
    ]);
    expect(r.map((x) => x.key)).toEqual(["propio", "abierto-cerca", "abierto-lejos", "proximo", "curso", "resultados"]);
  });

  it("la franja sólo lleva lo que todavía se puede hacer", () => {
    const r = bannerItems([item({ key: "a" }), item({ key: "b", phase: "results" }), item({ key: "c", phase: "upcoming" })]);
    expect(r.map((x) => x.key)).toEqual(["a", "c"]);
  });
});

describe("textos", () => {
  it("días que faltan", () => {
    expect(daysLeft(enDias(26.5), ahora)).toBe(26);
    expect(daysLeft(enDias(-1), ahora)).toBeNull();
  });

  it("línea de fecha", () => {
    expect(deadlineLine(item({ closesAt: new Date("2026-11-01T02:59:00Z") }), ahora)).toBe("Cierra el 31/10 · quedan 25 días");
    expect(deadlineLine(item({ phase: "results" }), ahora)).toBe("Resultados publicados");
    expect(deadlineLine(item({ phase: "in_progress", source: "clickaton" }), ahora)).toBe("En curso");
  });

  it("botón", () => {
    expect(ctaLabel(item({ source: "clickaton" }))).toBe("Inscribirme");
    expect(ctaLabel(item({}))).toBe("Participar");
    expect(ctaLabel(item({ phase: "results" }))).toBe("Ver resultados");
  });

  it("marca de origen", () => {
    expect(withTracking("https://fotorank.com/concursos/x", "sfpr")).toBe(
      "https://fotorank.com/concursos/x?utm_source=fotoffice&utm_medium=vitrina&utm_campaign=sfpr",
    );
  });
});
