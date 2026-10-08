import { describe, expect, it } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { calcularItemDelPanel, trabajoDesdeMotor } from "./panel-cuanto-cobro";
import { instanciarPropuesta } from "./instanciar-propuesta";
import type { ItemPresupuesto } from "./constantes";

const base = (id: string, datos: Partial<ItemPresupuesto> = {}): ItemPresupuesto => ({
  id, productId: "p1", nombre: "Viejo", descripcion: null, cantidad: 2, precioUnitario: 1, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});

const presupuesto = {
  client: { jobType: "Boda" },
  concepts: [{ name: "Cobertura", itemType: "own-service", quantity: "1", coverageHours: "6", editingHours: "4" }],
};
const concepto = (id: string): ItemPresupuesto =>
  base(id, { productId: null, nombre: "Cobertura boda", modoPrecio: "CALCULO", precioUnitario: 0, seccion: "Fotos", calculo: { entrada: { presupuesto } } as never });

let n = 0;
const nuevaClave = () => `nuevo-${++n}`;
const productos = new Map([["p1", { nombre: "  Cobertura  ", descripcion: " Seis horas ", precio: 150000 }]]);
const ahora = new Date("2026-10-08T12:00:00Z");

describe("instanciarPropuesta (puro)", () => {
  it("un producto de lista sale al precio de hoy, con clave nueva y sin cálculo", () => {
    const r = instanciarPropuesta([base("a")], { productos, perfil: null, nuevaClave, ahora });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items[0]).toMatchObject({ id: expect.stringMatching(/^nuevo-/), nombre: "Cobertura", descripcion: "Seis horas", precioUnitario: 150000, modoPrecio: "LISTA", calculo: null, cantidad: 2 });
  });

  it("un producto inactivo o ausente frena todo", () => {
    expect(instanciarPropuesta([base("a", { productId: "zzz" })], { productos, perfil: null, nuevaClave })).toEqual({ ok: false, motivo: "PRODUCTO_INACTIVO" });
  });

  it("un concepto calculado da el mismo precio que el panel y guarda el perfil", () => {
    const perfil = createBaseCompleteProfile();
    const r = instanciarPropuesta([concepto("c")], { productos, perfil, nuevaClave, ahora });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = trabajoDesdeMotor(presupuesto)!;
    const directo = calcularItemDelPanel(perfil, t.trabajo, t.tipoDeTrabajo, { id: "x", nombre: "Cobertura boda", seccion: "Fotos" }, ahora);
    expect(directo.ok).toBe(true);
    if (!directo.ok) return;
    expect(r.items[0]!.precioUnitario).toBe(directo.item.precioUnitario);
    expect(r.items[0]).toMatchObject({ modoPrecio: "CALCULO", nombre: "Cobertura boda", seccion: "Fotos" });
    expect((r.items[0]!.calculo as never as { entrada: { perfil?: unknown } }).entrada.perfil).toBeTruthy();
  });

  it("sin perfil, un concepto calculado no se puede", () => {
    expect(instanciarPropuesta([concepto("c")], { productos, perfil: null, nuevaClave })).toEqual({ ok: false, motivo: "SIN_PERFIL" });
  });

  it("un trabajo roto da CALCULO", () => {
    const roto = base("c", { productId: null, modoPrecio: "CALCULO", calculo: { entrada: { presupuesto: { concepts: [] } } } as never });
    expect(instanciarPropuesta([roto], { productos, perfil: createBaseCompleteProfile(), nuevaClave })).toEqual({ ok: false, motivo: "CALCULO" });
  });
});
