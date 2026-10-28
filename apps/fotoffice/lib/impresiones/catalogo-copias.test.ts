import { describe, expect, it } from "vitest";
import { cotizarCopias, leerProductosDeCopia } from "./catalogo-copias";

const FOTOLAG = "prov-fotolag";
const ISLA = "prov-isla";
let n = 0;
const P = (name: string, precio: number, costo: number | null, prov: string | null) => ({ id: `p${++n}`, name, priceArs: precio, costArs: costo, preferredProveedorId: prov });

// Nombres reales del catálogo de DNX Estudio (28/10/2026).
const CATALOGO = leerProductosDeCopia([
  P("Copia instantánea 10x15", 5000, null, null),
  P("Copia instantánea 13x18", 7000, null, null),
  P("Copia para mañana 10x15 · más de 10", 3000, 400, FOTOLAG),
  P("Copia para mañana 10x15 · más de 50", 2000, 400, FOTOLAG),
  P("Copia para mañana 10x15 · más de 100", 1500, 400, FOTOLAG),
  P("Copia para mañana 13x18 · más de 10", 4500, 600, FOTOLAG),
  P("Copia próxima semana 10x15 · más de 10", 2000, 400, FOTOLAG),
  P("Ampliación 20x30 para mañana", 4500, 1500, FOTOLAG),
  P("Ampliación 20x30 próxima semana", 3000, 1500, FOTOLAG),
  P("Ampliación 30x40", 11700, 4300, ISLA),
  P("Cuadro canvas 30x40", 30000, 10000, ISLA),
  P("Portarretratos madera 13x18", 0, null, null),
]);

describe("cotizar copias con el catálogo", () => {
  it("lee los formatos del catálogo y descarta lo que no es copia", () => {
    expect(CATALOGO.map((p) => `${p.medida}|${p.plazo}|${p.desde}`)).toEqual([
      "10x15|INSTANTANEA|0", "13x18|INSTANTANEA|0", "10x15|MANANA|10", "10x15|MANANA|50", "10x15|MANANA|100", "13x18|MANANA|10",
      "10x15|SEMANA|10", "20x30|MANANA|0", "20x30|SEMANA|0", "30x40|SEMANA|0",
    ]);
  });

  it("escalones: desde 10 vale 'más de 10'; menos de 10 paga la instantánea y va al laboratorio para mañana", () => {
    const precio = (cantidad: number) => {
      const r = cotizarCopias([{ medida: "10x15", plazo: "MANANA", cantidad }], CATALOGO);
      if (!r.ok) throw new Error(r.falta);
      return r.lineas[0];
    };
    expect(precio(9)).toMatchObject({ precioUnitario: 5000, plazo: "MANANA", proveedorId: FOTOLAG, costoUnitario: 400 });
    expect(precio(10).precioUnitario).toBe(3000);
    expect(precio(50).precioUnitario).toBe(2000);
    expect(precio(100).precioUnitario).toBe(1500);
  });

  it("pocas copias para la próxima semana: precio de la instantánea y salen para mañana", () => {
    const r = cotizarCopias([{ medida: "10x15", plazo: "SEMANA", cantidad: 5 }], CATALOGO);
    expect(r.ok && r.lineas[0]).toMatchObject({ precioUnitario: 5000, plazo: "MANANA", proveedorId: FOTOLAG });
  });

  it("la cantidad del escalón suma todas las líneas de la misma medida y plazo", () => {
    const r = cotizarCopias([{ medida: "10x15", plazo: "MANANA", cantidad: 6 }, { medida: "10x15", plazo: "MANANA", cantidad: 6 }], CATALOGO);
    expect(r.ok && r.lineas.map((l) => l.precioUnitario)).toEqual([3000, 3000]);
    expect(r.ok && r.subtotal).toBe(36000);
  });

  it("ampliaciones de Fotolag con plazo y de La Isla sin plazo (próxima semana)", () => {
    const r = cotizarCopias([{ medida: "20x30", plazo: "MANANA", cantidad: 2 }, { medida: "30x40", plazo: "SEMANA", cantidad: 3 }], CATALOGO);
    expect(r.ok && r.lineas.map((l) => [l.precioUnitario, l.plazo, l.proveedorId])).toEqual([[4500, "MANANA", FOTOLAG], [11700, "SEMANA", ISLA]]);
  });

  it("instantánea: sin laboratorio", () => {
    const r = cotizarCopias([{ medida: "13x18", plazo: "INSTANTANEA", cantidad: 2 }], CATALOGO);
    expect(r.ok && r.lineas[0]).toMatchObject({ precioUnitario: 7000, proveedorId: null, plazo: "INSTANTANEA" });
  });

  it("lo que no está en el catálogo no se inventa", () => {
    expect(cotizarCopias([{ medida: "13x13", plazo: "MANANA", cantidad: 2 }], CATALOGO)).toEqual({ ok: false, falta: "13x13 para mañana" });
    expect(cotizarCopias([{ medida: "30x40", plazo: "MANANA", cantidad: 1 }], CATALOGO)).toEqual({ ok: false, falta: "30x40 para mañana" });
  });
});
