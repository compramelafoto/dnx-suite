import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import { neighborWorks, workAccess, workPath, workUrl } from "./work-access";

const a = { galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: null as unknown, startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
const obras = [
  { id: "w1", isHighlight: true, sortOrder: 0 },
  { id: "w2", isHighlight: false, sortOrder: 1 },
];
const antes = new Date("2026-11-01T15:00:00Z");
const abierta = new Date("2026-11-10T15:00:00Z");
const cerrada = new Date("2026-11-25T15:00:00Z");

describe("acceso a una obra", () => {
  it("una destacada se ve completa mientras la muestra está abierta", () => expect(workAccess(a, obras, "w1", abierta)).toBe("FULL"));
  it("una no destacada queda sólo como ficha mientras está abierta", () => expect(workAccess(a, obras, "w2", abierta)).toBe("TEASER"));
  it("y también antes de abrir", () => expect(workAccess(a, obras, "w2", antes)).toBe("TEASER"));
  it("al cerrar se ven todas", () => expect(workAccess(a, obras, "w2", cerrada)).toBe("FULL"));
  it("en modo completa se ven todas desde el principio", () => {
    expect(workAccess({ ...a, galleryMode: "FULL" }, obras, "w2", antes)).toBe("FULL");
  });
  it("sin destacadas se ven las primeras 12, igual que en la galería", () => {
    const muchas = Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, isHighlight: false, sortOrder: i }));
    expect(workAccess(a, muchas, "w11", abierta)).toBe("FULL");
    expect(workAccess(a, muchas, "w12", abierta)).toBe("TEASER");
  });
  it("una obra que no es de esta muestra no existe", () => expect(workAccess(a, obras, "otra", cerrada)).toBeNull());
});

describe("dirección de la obra", () => {
  it("arma la ruta y la URL sin barras dobles", () => {
    expect(workPath("miradas-abc123", "clx9")).toBe("/m/miradas-abc123/o/clx9");
    expect(workUrl("https://muestrasfotograficas.com/", "miradas-abc123", "clx9")).toBe("https://muestrasfotograficas.com/m/miradas-abc123/o/clx9");
  });
});

describe("anterior y siguiente", () => {
  const v = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("en el medio tiene las dos", () => expect(neighborWorks(v, "b")).toEqual({ prev: { id: "a" }, next: { id: "c" } }));
  it("en los bordes, una sola", () => {
    expect(neighborWorks(v, "a")).toEqual({ prev: null, next: { id: "b" } });
    expect(neighborWorks(v, "c")).toEqual({ prev: { id: "b" }, next: null });
  });
  it("si la obra no está entre las visibles, ninguna", () => expect(neighborWorks(v, "z")).toEqual({ prev: null, next: null }));
});

describe("acceso a una obra con la sorpresa (etapa 6)", () => {
  it("sorpresa total: toda obra es sólo ficha mientras está abierta", () => {
    expect(workAccess({ ...a, visibility: { v: 1, online: { exhibited: "NONE" } } }, obras, "w1", abierta)).toBe("TEASER");
  });
  it("para cada visitante: toda obra expuesta es sólo ficha mientras está abierta", () => {
    const v = { v: 1, online: { exhibited: "RANDOM", randomCount: 1, rotation: "PER_VISIT", seed: "s" } };
    expect(workAccess({ ...a, visibility: v }, obras, "w1", abierta)).toBe("TEASER");
    expect(workAccess({ ...a, visibility: v }, obras, "w1", cerrada)).toBe("FULL");
  });
});
