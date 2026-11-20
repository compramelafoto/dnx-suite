import { describe, expect, it } from "vitest";
import type { ItemPresupuesto } from "./constantes";
import { soloLaAlternativa, totalesConAlternativas, type Alternativa } from "./alternativas";

const item = (id: string, precio: number, datos: Partial<ItemPresupuesto> = {}): ItemPresupuesto => ({
  id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: precio, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});
const ALT: Alternativa[] = [
  { id: "b", nombre: "Básico", descripcion: null, masElegida: false },
  { id: "i", nombre: "Intermedio", descripcion: null, masElegida: true },
  { id: "p", nombre: "Premium", descripcion: null, masElegida: false },
];

describe("soloLaAlternativa (el paquete estándar que eligió el cliente por el bot)", () => {
  const items = [
    item("1", 100, { alternativaId: "b" }),
    item("2", 200, { alternativaId: "i" }),
    item("3", 50, { alternativaId: "i", opcional: true }),
    item("4", 300, { alternativaId: "p" }),
    // Sin opción: va a la principal (Intermedio), como en el resto del sistema.
    item("5", 10),
  ];

  it("deja sólo los ítems de esa opción, sin alternativaId, y el total coincide con el de la opción", () => {
    const solo = soloLaAlternativa(items, ALT, "intermedio")!;
    expect(solo.map((i) => i.id)).toEqual(["2", "3", "5"]);
    expect(solo.every((i) => !("alternativaId" in i))).toBe(true);
    const conOpciones = totalesConAlternativas(items.map((i) => (i.alternativaId ? i : { ...i, alternativaId: "i" })), ALT, null);
    const deIntermedio = conOpciones.alternativas.find((a) => a.id === "i")!.totales.total;
    expect(totalesConAlternativas(solo, [], null).totales.total).toBe(deIntermedio);
  });

  it("busca el nombre sin tildes ni mayúsculas", () => {
    expect(soloLaAlternativa(items, ALT, "BASICO")!.map((i) => i.id)).toEqual(["1"]);
  });

  it("null si no hay opciones o ninguna se llama así", () => {
    expect(soloLaAlternativa(items, ALT, "Gold")).toBeNull();
    expect(soloLaAlternativa(items, [], "Básico")).toBeNull();
    expect(soloLaAlternativa(items, ALT, "  ")).toBeNull();
  });
});
