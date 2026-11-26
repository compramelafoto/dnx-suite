import { describe, expect, it } from "vitest";
import { hrefBandeja, leerFiltros, quienAtiende } from "./filtros";

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const h = (n: number) => new Date(AHORA.getTime() + n * 3600_000);

describe("leerFiltros", () => {
  it("por omisión: todos, abiertos, todas las campañas", () => {
    expect(leerFiltros({}, 4)).toEqual({ quien: "todos", canal: "todos", estado: "abiertos", campana: "todas", q: "" });
  });
  it("lee cada eje y descarta lo inventado", () => {
    expect(leerFiltros({ quien: "12", canal: "INSTAGRAM", estado: "esperando", campana: "123", q: "  hola " }, 4)).toEqual({
      quien: 12, canal: "INSTAGRAM", estado: "esperando", campana: "123", q: "hola",
    });
    expect(leerFiltros({ quien: "x1", canal: "FAX", estado: "raro", campana: "<script>" }, 4)).toMatchObject({
      quien: "todos", canal: "todos", estado: "abiertos", campana: "todas",
    });
  });
  it("traduce los enlaces viejos con ?filtro=", () => {
    expect(leerFiltros({ filtro: "mios" }, 4).quien).toBe(4);
    expect(leerFiltros({ filtro: "bot" }, 4).quien).toBe("bot");
    expect(leerFiltros({ filtro: "sin-asignar" }, 4).quien).toBe("sin-asignar");
    expect(leerFiltros({ filtro: "resueltos" }, 4).estado).toBe("resueltos");
  });
  it("recorta la búsqueda a 80", () => expect(leerFiltros({ q: "a".repeat(100) }, 4).q).toHaveLength(80));
});

describe("hrefBandeja", () => {
  it("omite lo que está por omisión y conserva el resto", () => {
    expect(hrefBandeja(leerFiltros({}, 4))).toBe("/bandeja");
    expect(hrefBandeja(leerFiltros({ quien: "7", q: "xv" }, 4), "/bandeja/abc")).toBe("/bandeja/abc?quien=7&q=xv");
  });
});

describe("quienAtiende", () => {
  const c = (p: Record<string, unknown>) => ({ estado: "HUMANO" as const, asignadoUserId: null, botPausadoHasta: null, ultimoEntranteEn: null, ...p });
  it("BOT y la pausa vencida sin asignar: el bot", () => {
    expect(quienAtiende(c({ estado: "BOT" }), AHORA)).toBe("bot");
    expect(quienAtiende(c({ botPausadoHasta: h(-1) }), AHORA)).toBe("bot");
  });
  it("sin asignar: pausa vigente, sin pausa o número excluido", () => {
    expect(quienAtiende(c({ botPausadoHasta: h(1) }), AHORA)).toBe("sin-asignar");
    expect(quienAtiende(c({}), AHORA)).toBe("sin-asignar");
    expect(quienAtiende(c({ estado: "BOT", botExcluido: true }), AHORA)).toBe("sin-asignar");
  });
  it("con persona: su id", () => expect(quienAtiende(c({ asignadoUserId: 7 }), AHORA)).toBe(7));
});
