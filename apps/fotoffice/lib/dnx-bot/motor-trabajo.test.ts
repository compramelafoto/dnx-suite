import { describe, expect, it } from "vitest";
import { toInputSchema } from "@repo/dnx-bot";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { armarItemsDelAsistente, trabajoVacio } from "@/lib/presupuestos/panel-cuanto-cobro";
import { perfilBase } from "./motor";
import { cotizar, esquemaCotizacion, repartirTotal, tarjetaDeCotizacion, trabajoBotAPanel, type TrabajoBot } from "./motor-trabajo";

const AHORA = new Date("2026-10-12T15:00:00Z");
const claves = () => {
  let n = 0;
  return () => `k${++n}`;
};
const perfil = () => createBaseCompleteProfile();
const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const BODA: TrabajoBot[] = [
  { nombre: "Cobertura", horasCobertura: "8", horasEdicion: "20", horasViaje: "2", horasCliente: "3" },
  { nombre: "Álbum", tipo: "physical-product", costoProveedor: "180000", margenDeseado: "30" },
];

describe("esquemaCotizacion", () => {
  it("convierte a JSON Schema y no acepta montos con $ ni horas en texto", () => {
    expect(toInputSchema(esquemaCotizacion).type).toBe("object");
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "Boda", conceptos: BODA }).success).toBe(true);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "Boda", conceptos: [{ nombre: "x", costoProveedor: "$180.000" }] }).success).toBe(false);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "Boda", conceptos: [{ nombre: "x", horasCobertura: "ocho" }] }).success).toBe(false);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "Boda", conceptos: [] }).success).toBe(false);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "Boda", conceptos: Array.from({ length: 11 }, () => ({ nombre: "x" })) }).success).toBe(false);
  });
});

describe("trabajoBotAPanel", () => {
  it("completa con trabajoVacio y normaliza la coma decimal", () => {
    expect(trabajoBotAPanel({ nombre: "Cobertura", horasCobertura: "1,5" })).toEqual({ ...trabajoVacio("Cobertura"), horasCobertura: "1.5" });
  });
});

describe("repartirTotal", () => {
  it("en proporción al sugerido, en pesos enteros, y el último absorbe el redondeo", () => {
    expect(repartirTotal([100, 200], 600)).toEqual([200, 400]);
    const r = repartirTotal([1, 1, 1], 1000);
    expect(r).toEqual([333, 333, 334]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1000);
  });
  it("sin sugeridos, en partes iguales", () => {
    expect(repartirTotal([0, 0], 101)).toEqual([50, 51]);
  });
});

describe("cotizar", () => {
  it("sin perfil completo no hay precio: PERFIL_INCOMPLETO con lo que falta", () => {
    const r = cotizar(perfilBase(null), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    expect(r.estado).toBe("PERFIL_INCOMPLETO");
    expect(r.faltan.length).toBeGreaterThan(0);
    expect(r).not.toHaveProperty("items");
  });

  it("le faltan datos al concepto: FALTAN_DATOS con lo que dice el motor", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: [{ nombre: "Cobertura" }] }, { nuevaClave: claves(), ahora: AHORA });
    expect(r.estado).toBe("FALTAN_DATOS");
    expect(r.faltan.join(" ")).toMatch(/Cobertura/);
  });

  it("bot = panel: el mismo trabajo da exactamente los mismos ítems que «Armar con ¿Cuánto Cobro?»", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    const panel = armarItemsDelAsistente(perfil(), BODA.map(trabajoBotAPanel), "Boda", { nuevaClave: claves(), ahora: AHORA });
    expect(r.estado).toBe("OK");
    expect(panel.ok).toBe(true);
    if (r.estado !== "OK" || !panel.ok) return;
    expect(r.items).toEqual(panel.items);
  });

  it("resumen formateado: por concepto y total (suma de lo que da el motor)", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    const [a, b] = r.items.map((i) => i.calculo!);
    expect(r.resumen.conceptos[0]).toMatchObject({ nombre: "Cobertura", precio: pesos(a!.precioElegido), precioMinimo: pesos(a!.precioMinimo) });
    expect(r.resumen.total.elegido).toBe(pesos(a!.precioElegido + b!.precioElegido));
    expect(r.resumen.total.minimo).toBe(pesos(a!.precioMinimo + b!.precioMinimo));
    expect(r.resumen.total.ganancia).toBe(pesos(a!.margenElegido + b!.margenElegido));
    expect(r.resumen.valorHora).toBe(pesos(a!.valorHora));
  });

  it("precio total elegido: se reparte en proporción, cada ítem queda ajustado y el total es exacto", () => {
    const sin = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA, precioTotalElegido: "1100000" }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK" || sin.estado !== "OK") throw new Error("no cotizó");
    expect(r.items.reduce((s, i) => s + i.precioUnitario, 0)).toBe(1100000);
    for (const it of r.items) expect(it.calculo!.precioElegido).toBe(it.precioUnitario);
    // El sugerido del motor no cambia: el precio a mano queda como ajuste.
    expect(r.items.map((i) => i.calculo!.precioSugerido)).toEqual(sin.items.map((i) => i.calculo!.precioSugerido));
    expect(r.resumen.total.elegido).toBe(pesos(1100000));
  });

  it("precio elegido cero o negativo no vale", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA, precioTotalElegido: "0" }, { nuevaClave: claves(), ahora: AHORA });
    expect(r.estado).toBe("INVALIDO");
  });
});

describe("tarjetaDeCotizacion", () => {
  it("filas con las cifras del servidor (recomendado, mínimo, ganancia) y una por concepto", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    const t = tarjetaDeCotizacion(r.resumen, "Boda");
    expect(t.titulo).toBe("¿Cuánto cobro? · Boda");
    expect(t.filas.map((f) => f.etiqueta)).toEqual(expect.arrayContaining(["Precio", "Mínimo para no perder", "Ganancia", "Cobertura", "Álbum"]));
    expect(t.filas.length).toBeLessThanOrEqual(12);
  });
});

describe("ganancia desmedida: la tarjeta pide revisar (no cambia la cuenta del motor)", () => {
  it("con un precio a mano muy por encima del costo, avisa; con uno normal, no", () => {
    // El perfil de las pruebas del motor tiene un valor hora de $1.848: $1.100.000 da una ganancia de miles por ciento.
    const alto = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA, precioTotalElegido: "1100000" }, { nuevaClave: claves(), ahora: AHORA });
    if (alto.estado !== "OK") throw new Error(alto.estado);
    const t = tarjetaDeCotizacion(alto.resumen, "Boda");
    expect(t.avisos[0]).toBe("La ganancia es más de 3 veces el costo: revisá que las horas y los costos del trabajo estén completos.");
    expect(t.filas.find((f) => f.etiqueta === "Ganancia")!.valor).toBe(`${alto.resumen.total.ganancia} (${alto.resumen.total.gananciaPct})`);
    const normal = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    if (normal.estado !== "OK") throw new Error(normal.estado);
    expect(tarjetaDeCotizacion(normal.resumen, "Boda").avisos.join(" ")).not.toMatch(/revisá/);
  });
});
