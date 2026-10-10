import { describe, expect, it } from "vitest";
import { visibleWorks } from "./gallery";
import { dayEndAr, dayStartAr } from "./dates";

const works = [
  { id: "a", isHighlight: false, sortOrder: 2 },
  { id: "b", isHighlight: true, sortOrder: 1 },
  { id: "c", isHighlight: true, sortOrder: 0 },
];
const fechas = { startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
const abierta = new Date("2026-11-10T15:00:00Z");
const cerrada = new Date("2026-12-01T15:00:00Z");

describe("visibleWorks", () => {
  it("abierta en modo destacadas: sólo destacadas, ordenadas", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, works, abierta);
    expect(r.works.map((w) => w.id)).toEqual(["c", "b"]);
    expect(r.isPartial).toBe(true);
  });
  it("cerrada: todas", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, works, cerrada);
    expect(r.works.map((w) => w.id)).toEqual(["c", "b", "a"]);
    expect(r.isPartial).toBe(false);
  });
  it("modo completa: todas aunque esté abierta", () => {
    expect(visibleWorks({ ...fechas, galleryMode: "FULL" }, works, abierta).works).toHaveLength(3);
  });
  it("sin destacadas marcadas, muestra las primeras 12", () => {
    const muchas = Array.from({ length: 20 }, (_, i) => ({ id: String(i), isHighlight: false, sortOrder: i }));
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, muchas, abierta);
    expect(r.works).toHaveLength(12);
    expect(r.isPartial).toBe(true);
  });
});

describe("visibleWorks con la sorpresa de la muestra (etapa 6)", () => {
  const sorpresa = { v: 1, online: { exhibited: "NONE" } };
  const porVisita = { v: 1, online: { exhibited: "RANDOM", randomCount: 2, rotation: "PER_VISIT", seed: "s" } };
  it("sin ajuste devuelve lo mismo que antes, sin anticipo por visita", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: null }, works, abierta);
    expect(r).toEqual({ works: [works[2], works[1]], isPartial: true, hiddenCount: 1, perVisit: null });
  });
  it("sorpresa total: galería vacía mientras está abierta", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "FULL", visibility: sorpresa }, works, abierta);
    expect(r.works).toEqual([]);
    expect(r.hiddenCount).toBe(3);
  });
  it("para cada visitante: no devuelve obras, sólo cuántas", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "FULL", visibility: porVisita }, works, abierta);
    expect(r).toEqual({ works: [], isPartial: true, hiddenCount: 3, perVisit: { count: 2, total: 3 } });
  });
  it("al cerrar se ve todo", () => {
    expect(visibleWorks({ ...fechas, galleryMode: "FULL", visibility: porVisita }, works, cerrada).works).toHaveLength(3);
  });
});
