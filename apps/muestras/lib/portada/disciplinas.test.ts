import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "@repo/muestras";
import { chipsDeDisciplina, muestrasParaGrilla, tipoDeFiltro, tiposDeFiltro } from "./disciplinas";

describe("chipsDeDisciplina", () => {
  const lista = [
    { primaryDiscipline: "ESCULTURA", otherDisciplines: ["DIBUJO"] },
    { primaryDiscipline: "PINTURA", otherDisciplines: [] },
  ];
  const filtros = { pais: "Argentina", provincia: "Santa Fe", tipo: undefined, abiertas: "1", archivo: "", cerca: "-32.9,-60.6", lugar: "Rosario" };

  it("«Todas» primero y después sólo las presentes, en el orden fijo, conservando los otros filtros", () => {
    const chips = chipsDeDisciplina(lista, filtros, null);
    expect(chips.map((c) => c.etiqueta)).toEqual(["Todas", "Pintura", "Dibujo", "Escultura"]);
    expect(chips[0]).toEqual({ etiqueta: "Todas", href: "/?pais=Argentina&provincia=Santa+Fe&abiertas=1&cerca=-32.9%2C-60.6&lugar=Rosario#muestras", activo: true });
    expect(chips[1]!.href).toBe("/?pais=Argentina&provincia=Santa+Fe&abiertas=1&cerca=-32.9%2C-60.6&lugar=Rosario&disciplina=PINTURA#muestras");
    expect(chips[1]!.activo).toBe(false);
  });
  it("marca la elegida, y la muestra aunque no quede ninguna con ella", () => {
    const chips = chipsDeDisciplina(lista, {}, "GRABADO");
    expect(chips.map((c) => [c.etiqueta, c.activo])).toEqual([["Todas", false], ["Pintura", false], ["Dibujo", false], ["Grabado y obra gráfica", true], ["Escultura", false]]);
    expect(chips[0]!.href).toBe("/#muestras");
  });
});

describe("muestrasParaGrilla", () => {
  const ahora = new Date("2026-11-10T15:00:00Z");
  const base = { type: "MUESTRA", isCancelled: false, organizersText: null, coverImageUrl: "https://x/portada.jpg", primaryDiscipline: "PINTURA", startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") };
  it("sólo muestras de arte abiertas o próximas con portada, hasta 8", () => {
    const items = [
      { ...base, slug: "abierta", title: "Abierta" },
      { ...base, slug: "proxima", title: "Próxima", startsAt: dayStartAr("2026-12-01"), endsAt: dayEndAr("2026-12-20") },
      { ...base, slug: "cerrada", title: "Cerrada", startsAt: dayStartAr("2026-10-01"), endsAt: dayEndAr("2026-10-20") },
      { ...base, slug: "foto", title: "Foto", primaryDiscipline: "FOTOGRAFIA" },
      { ...base, slug: "sin-portada", title: "Sin portada", coverImageUrl: null },
      { ...base, slug: "cancelada", title: "Cancelada", isCancelled: true },
      { ...base, slug: "taller", title: "Taller", type: "TALLER" },
    ];
    expect(muestrasParaGrilla(items, ahora)).toEqual([
      { slug: "abierta", title: "Abierta", coverImageUrl: "https://x/portada.jpg", organizersText: null },
      { slug: "proxima", title: "Próxima", coverImageUrl: "https://x/portada.jpg", organizersText: null },
    ]);
    const muchas = Array.from({ length: 12 }, (_, i) => ({ ...base, slug: `m${i}`, title: `M${i}` }));
    expect(muestrasParaGrilla(muchas, ahora)).toHaveLength(8);
  });
});

describe("tiposDeFiltro", () => {
  it("fotografía ofrece todos los tipos, con la salida fotográfica", () => {
    expect(tiposDeFiltro("FOTOGRAFIA")).toEqual(["MUESTRA", "CHARLA", "TALLER", "SALIDA", "LIBRO", "PROYECCION", "OTRA"]);
  });
  it("arte no ofrece la salida fotográfica", () => {
    expect(tiposDeFiltro("ARTE")).toEqual(["MUESTRA", "CHARLA", "TALLER", "LIBRO", "PROYECCION", "OTRA"]);
  });
  it("en arte `?tipo=SALIDA` no filtra; en fotografía sí", () => {
    expect(tipoDeFiltro("ARTE", "SALIDA")).toBeUndefined();
    expect(tipoDeFiltro("FOTOGRAFIA", "SALIDA")).toBe("SALIDA");
    expect(tipoDeFiltro("ARTE", "TALLER")).toBe("TALLER");
    expect(tipoDeFiltro("FOTOGRAFIA", "CUALQUIERA")).toBeUndefined();
    expect(tipoDeFiltro("ARTE", undefined)).toBeUndefined();
  });
});
