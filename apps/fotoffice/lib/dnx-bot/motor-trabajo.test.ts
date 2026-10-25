import { describe, expect, it } from "vitest";
import { toInputSchema } from "@repo/dnx-bot";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { ajustesVacios, armarItemsDelAsistente, trabajoVacio } from "@/lib/presupuestos/panel-cuanto-cobro";
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

describe("entrevista completa: disparos, costos variables y desglose", () => {
  const camara = () =>
    createBaseCompleteProfile({ primaryCameraPresetId: "custom", primaryCameraCustomName: "Sony A7C", primaryCameraReplacementValue: "3000000", primaryCameraShutterRating: "200000" });
  const XV: TrabajoBot[] = [
    { nombre: "Cobertura", horasCobertura: "10", horasEdicion: "8", horasViaje: "1", horasCliente: "2", disparosEstimados: "3000" },
    { nombre: "Impresiones", tipo: "physical-product", costoProveedor: "90000", costoEmbalaje: "5000" },
    { nombre: "Asistente", tipo: "outsourced", costoTercerizado: "60000" },
    { nombre: "Combustible y peajes", tipo: "expense", costoGasto: "25000" },
  ];

  it("el esquema acepta los disparos del trabajo y el embalaje; nada de eso es del perfil", () => {
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "XV", conceptos: XV }).success).toBe(true);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "XV", conceptos: [{ nombre: "x", disparosEstimados: "muchos" }] }).success).toBe(false);
    expect(trabajoBotAPanel(XV[0]!).disparosEstimados).toBe("3000");
    expect(trabajoBotAPanel(XV[1]!).costoEmbalaje).toBe("5000");
  });

  it("el desgaste de la cámara de ESTE trabajo sale del motor (disparos × valor / vida útil) y se muestra", () => {
    const r = cotizar(camara(), { tipoDeTrabajo: "XV", conceptos: XV }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    // 3000 × (3.000.000 / 200.000) = 45.000.
    expect(r.resumen.desgasteCamara).toEqual({ disparos: 3000, monto: pesos(45_000), sumado: true });
    const t = tarjetaDeCotizacion(r.resumen, "XV");
    expect(t.filas.find((f) => f.etiqueta.startsWith("Desgaste de cámara"))).toEqual({ etiqueta: "Desgaste de cámara (3000 disparos)", valor: `${pesos(45_000)} (sumado)` });
    expect(t.avisos.join(" ")).not.toMatch(/estructural|aporte mensual|modelo anterior/i);
    // Se sumó al costo del trabajo: el mismo trabajo sin disparos cuesta $45.000 menos.
    const sin = cotizar(camara(), { tipoDeTrabajo: "XV", conceptos: [{ ...XV[0]!, disparosEstimados: undefined }, ...XV.slice(1)] }, { nuevaClave: claves(), ahora: AHORA });
    if (sin.estado !== "OK") throw new Error(sin.estado);
    expect(r.items[0]!.calculo!.costosVariables - sin.items[0]!.calculo!.costosVariables).toBe(45_000);
  });

  it("los costos variables (productos, tercerizados, gastos) están en el desglose por concepto", () => {
    const r = cotizar(camara(), { tipoDeTrabajo: "XV", conceptos: XV }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.resumen.conceptos.map((c) => c.nombre)).toEqual(["Cobertura", "Impresiones", "Asistente", "Combustible y peajes"]);
    const t = tarjetaDeCotizacion(r.resumen, "XV");
    for (const n of ["Impresiones", "Asistente", "Combustible y peajes"]) expect(t.filas.map((f) => f.etiqueta)).toContain(n);
    expect(t.filas.find((f) => f.etiqueta === "Costos variables")!.valor).toBe(r.resumen.total.costosVariables);
  });

  it("sin disparos en un servicio propio, avisa que el desgaste no está contado", () => {
    const r = cotizar(camara(), { tipoDeTrabajo: "XV", conceptos: [{ nombre: "Cobertura", horasCobertura: "10" }] }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(tarjetaDeCotizacion(r.resumen, "XV").avisos).toContain("Faltan los disparos estimados del trabajo: el desgaste de la cámara no está contado.");
  });

  it("parcial: el resultado y la tarjeta lo dicen", () => {
    const r = cotizar(camara(), { tipoDeTrabajo: "XV", conceptos: [{ nombre: "Cobertura", horasCobertura: "10" }], parcial: true }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.resumen.parcial).toBe(true);
    expect(tarjetaDeCotizacion(r.resumen, "XV").titulo).toBe("¿Cuánto cobro? · XV (parcial)");
  });
});

describe("extras del trabajo: una lista de conceptos, cada uno con su tipo", () => {
  const XV_CON_EXTRAS: TrabajoBot[] = [
    { nombre: "Cobertura XV", horasCobertura: "6", horasEdicion: "10", horasViaje: "1", horasCliente: "2", disparosEstimados: "2500" },
    { nombre: "Sesión previa", horasCobertura: "2", horasEdicion: "3", horasViaje: "1", disparosEstimados: "400" },
    { nombre: "Fotolibro", tipo: "physical-product", costoProveedor: "120000", horasDiseno: "4", costoEnvio: "8000", costoEmbalaje: "3000", margenDeseado: "30" },
  ];

  it("cada extra es su propio ítem, con su tipo, y la tarjeta muestra el subtotal de cada uno (costo + ganancia)", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "XV", conceptos: XV_CON_EXTRAS }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.items.map((i) => i.nombre)).toEqual(["Cobertura XV", "Sesión previa", "Fotolibro"]);
    expect(r.resumen.conceptos.map((c) => [c.tipo, c.margenPedido])).toEqual([
      ["servicio propio", null],
      ["servicio propio", null],
      ["producto", "30 %"],
    ]);
    const t = tarjetaDeCotizacion(r.resumen, "XV");
    for (const c of r.resumen.conceptos) {
      expect(t.filas.find((f) => f.etiqueta === c.nombre)!.valor).toBe(`${c.precio} (costo ${c.costo} + ganancia ${c.ganancia})`);
    }
    expect(t.filas.find((f) => f.etiqueta === "Precio")!.valor).toBe(r.resumen.total.elegido);
  });

  it("el % de ganancia del fotolibro se respeta: el mínimo del producto es su costo + 30 %", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "XV", conceptos: XV_CON_EXTRAS }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    const libro = r.items[2]!.calculo!;
    // Costo = proveedor + envío + embalaje + horas de diseño al valor hora.
    expect(libro.costoBase).toBeCloseTo(120_000 + 8_000 + 3_000 + 4 * libro.valorHora, 1);
    expect(Math.abs(libro.precioMinimo - libro.costoBase * 1.3)).toBeLessThanOrEqual(1);
    const sinMargen = cotizar(perfil(), { tipoDeTrabajo: "XV", conceptos: [XV_CON_EXTRAS[2]!].map((c) => ({ ...c, margenDeseado: undefined })) }, { nuevaClave: claves(), ahora: AHORA });
    if (sinMargen.estado !== "OK") throw new Error(sinMargen.estado);
    expect(Math.abs(sinMargen.items[0]!.calculo!.precioMinimo - sinMargen.items[0]!.calculo!.costoBase)).toBeLessThanOrEqual(1);
    expect(tarjetaDeCotizacion(sinMargen.resumen, "XV").avisos).toContain("Fotolibro: sin % de ganancia sobre el producto (no se indicó; queda en 0 %).");
  });

  it("las horas con el cliente van sólo en el primer concepto (la sesión previa no las repite)", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "XV", conceptos: XV_CON_EXTRAS }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.items[0]!.calculo!.horasTotales).toBe(6 + 10 + 1 + 2);
    expect(r.items[1]!.calculo!.horasTotales).toBe(2 + 3 + 1);
  });
});

describe("precio completo: fecha, viaje, exprés y retoque (etapa A)", () => {
  const EXTRAS = {
    ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS,
    grossIncomePercent: "3",
    paymentCommissionPercent: "6",
    depositPercent: "30",
    sundaySurchargePercent: "15",
    expressSurchargePercent: "10",
    overtimeSurchargePercent: "50",
    travelMode: "zones" as const,
    travelZones: [{ id: "z1", name: "Rosario", upToKm: "15", amount: "0" }, { id: "z2", name: "Gran Rosario", upToKm: "60", amount: "25000" }],
    retouchMinutesPerPhoto: "6",
    minimumJobPrice: "900000000",
  };
  const conExtras = () => ({ ...perfil(), pricingExtras: EXTRAS });
  const AJUSTES = { fechaEvento: "2026-10-18", expres: true, distanciaKm: "40", fotosRetoque: "50" };

  it("el esquema acepta los ajustes y rechaza fechas o km en texto", () => {
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "XV", conceptos: BODA, ajustes: AJUSTES }).success).toBe(true);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "XV", conceptos: BODA, ajustes: { fechaEvento: "18 de octubre" } }).success).toBe(false);
    expect(esquemaCotizacion.safeParse({ tipoDeTrabajo: "XV", conceptos: BODA, ajustes: { distanciaKm: "cuarenta" } }).success).toBe(false);
  });

  it("sin extras ni ajustes, el resumen no trae precio completo (igual que antes)", () => {
    const r = cotizar(perfil(), { tipoDeTrabajo: "Boda", conceptos: BODA }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.resumen.precioCompleto).toBeNull();
  });

  it("bot = panel también con ajustes", () => {
    const r = cotizar(conExtras(), { tipoDeTrabajo: "XV", conceptos: BODA, ajustes: AJUSTES }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    const panel = armarItemsDelAsistente(conExtras(), BODA.map(trabajoBotAPanel), "XV", {
      nuevaClave: claves(),
      ahora: AHORA,
      ajustes: { ...ajustesVacios(), fechaEvento: "2026-10-18", expres: true, distanciaKm: "40", fotosRetoque: "50" },
    });
    if (!panel.ok) throw new Error(panel.error);
    expect(r.items.map((i) => i.precioUnitario)).toEqual(panel.items.map((i) => i.precioUnitario));
  });

  it("la tarjeta muestra el desglose: domingo, viáticos de la zona, retoque, IIBB y comisión, seña, hora extra y el mínimo", () => {
    const r = cotizar(conExtras(), { tipoDeTrabajo: "XV", conceptos: BODA, ajustes: AJUSTES }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    const pc = r.resumen.precioCompleto!;
    expect(pc.dia).toBe("domingo");
    expect(pc.viaticos).toBe(`${pesos(25_000)} (Gran Rosario, 40 km)`);
    const t = tarjetaDeCotizacion(r.resumen, "XV");
    const etiquetas = t.filas.map((f) => f.etiqueta);
    expect(etiquetas).toEqual(
      expect.arrayContaining(["Total para el cliente", "Recargos (domingo 15 % + exprés 10 %)", "Viáticos", "Retoque (50 fotos)", "Ingresos Brutos y comisión", "Seña (30 %)", "Saldo", "Hora extra", "Te queda"]),
    );
    expect(t.filas.length).toBeLessThanOrEqual(20);
    expect(t.avisos.join(" ")).toMatch(/mínimo/);
    expect(t.avisos.join(" ")).toMatch(/descuento por transferencia del 6 %/);
  });

  it("una zona que no existe en el perfil no se inventa", () => {
    const r = cotizar(conExtras(), { tipoDeTrabajo: "XV", conceptos: BODA, ajustes: { zona: "Luna" } }, { nuevaClave: claves(), ahora: AHORA });
    expect(r.estado).toBe("INVALIDO");
    if (r.estado === "INVALIDO") expect(r.error).toMatch(/Rosario, Gran Rosario/);
  });

  it("con un total a mano, la seña se calcula sobre ese total", () => {
    const r = cotizar(conExtras(), { tipoDeTrabajo: "XV", conceptos: BODA, ajustes: AJUSTES, precioTotalElegido: "2000000" }, { nuevaClave: claves(), ahora: AHORA });
    if (r.estado !== "OK") throw new Error(r.estado);
    expect(r.resumen.precioCompleto?.sena).toBe(`${pesos(600_000)} (30 %)`);
  });
});
