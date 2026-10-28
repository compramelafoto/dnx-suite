import { describe, expect, it } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { AJUSTES_POR_HORAS_POR_OMISION as OMISION, precioSegundoFotografo, recetaPorHoras } from "@/lib/presupuesto-automatico/por-horas-puro";
import { itemsPorHoras, segundoFotografoOpcional, valorHoraDeDaniel } from "./borrador-por-horas";
import type { ItemPresupuesto } from "./constantes";

const ahora = new Date("2026-10-28T12:00:00Z");
const receta = (km: number | null) => recetaPorHoras({ horas: 3, esSesion: false, km, enElEstudio: false, ajustes: OMISION });

describe("ítems del presupuesto por horas", () => {
  it("un renglón de cobertura: precio del motor + traslado, sin renglón de traslado", () => {
    const perfil = createBaseCompleteProfile();
    const sin = itemsPorHoras({ perfil, receta: receta(null), conSegundoFotografo: false, segundoFotografoPct: 30, tipoDeTrabajo: "Cumpleaños Infantil", ahora });
    const con = itemsPorHoras({ perfil, receta: receta(10), conSegundoFotografo: false, segundoFotografoPct: 30, tipoDeTrabajo: "Cumpleaños Infantil", ahora });
    if (!sin.ok || !con.ok) throw new Error("debía armar");
    expect(con.valor.items).toHaveLength(1);
    expect(sin.valor.items[0].precioUnitario).toBeGreaterThan(0);
    expect(con.valor.items[0].precioUnitario).toBe(sin.valor.items[0].precioUnitario + 30000);
    expect(con.valor.items[0]).toMatchObject({ nombre: "Cobertura fotográfica de 3 horas", modoPrecio: "CALCULO" });
    expect(con.valor.items[0].descripcion).toContain("mínimo de 400 fotos");
    expect(con.valor.traslado).toBe(30000);
    expect(con.valor.alternativas).toEqual([]);
  });

  it("con segundo fotógrafo: dos opciones y el segundo fotógrafo sólo en la segunda", () => {
    const perfil = createBaseCompleteProfile();
    const r = itemsPorHoras({ perfil, receta: receta(10), conSegundoFotografo: true, segundoFotografoPct: 30, tipoDeTrabajo: "Evento", ahora });
    if (!r.ok) throw new Error("debía armar");
    expect(r.valor.alternativas.map((a) => a.nombre)).toEqual(["Un fotógrafo", "Dos fotógrafos"]);
    expect(r.valor.items).toHaveLength(3);
    const segundo = r.valor.items.find((i) => i.nombre.startsWith("Segundo fotógrafo"))!;
    expect(segundo).toMatchObject({ alternativaId: "dos-fotografos", modoPrecio: "LISTA", productId: null, nombre: "Segundo fotógrafo (3 horas)" });
    expect(segundo.precioUnitario).toBe(precioSegundoFotografo(valorHoraDeDaniel(perfil), 3, 30));
    expect(new Set(r.valor.items.map((i) => i.id)).size).toBe(3);
  });

  it("perfil vacío: no arma", () => {
    expect(itemsPorHoras({ perfil: {} as never, receta: receta(10), conSegundoFotografo: false, segundoFotografoPct: 30, tipoDeTrabajo: "Evento", ahora })).toEqual({ ok: false, motivo: "PERFIL" });
  });
});

describe("segundo fotógrafo opcional en una propuesta con paquetes", () => {
  const calculo = (horas: string) => ({ entrada: { presupuesto: { concepts: [{ coverageHours: horas }] } } }) as never;
  const item = (id: string, alternativaId: string | null, horas: string | null): ItemPresupuesto => ({
    id, productId: null, nombre: id, descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null,
    modoPrecio: horas ? "CALCULO" : "LISTA", calculo: horas ? calculo(horas) : null, seccion: null, opcional: false, alternativaId,
  });

  it("agrega un ítem opcional por paquete con las horas de cobertura de ese paquete", () => {
    const alternativas = ["basico", "intermedio", "premium"].map((id) => ({ id, nombre: id, descripcion: null, masElegida: false }));
    const items = [item("a", "basico", "4"), item("b", "intermedio", "6"), item("c", "premium", "8"), item("d", "premium", null)];
    const r = segundoFotografoOpcional(items, alternativas, 10000, 30);
    const nuevos = r.slice(items.length);
    expect(nuevos.map((i) => [i.alternativaId, i.opcional, i.precioUnitario, i.nombre])).toEqual([
      ["basico", true, 12000, "Segundo fotógrafo (4 horas)"],
      ["intermedio", true, 18000, "Segundo fotógrafo (6 horas)"],
      ["premium", true, 24000, "Segundo fotógrafo (8 horas)"],
    ]);
  });

  it("sin valor de la hora o sin horas de cobertura no agrega nada", () => {
    const items = [item("a", null, "4")];
    expect(segundoFotografoOpcional(items, [], null, 30)).toEqual(items);
    expect(segundoFotografoOpcional([item("x", null, null)], [], 10000, 30)).toHaveLength(1);
  });
});
