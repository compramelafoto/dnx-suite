import { z } from "@repo/dnx-bot";
import { formatCuantoCobroCurrency, parseCuantoCobroAmount, type CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { resumirPerfil } from "@/lib/precios/resumen";
import { entradaDelMotor, recalcularItemCalculo } from "@/lib/presupuestos/calculo-cuanto-cobro";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { armarItemsDelAsistente, trabajoVacio, type TrabajoPanel } from "@/lib/presupuestos/panel-cuanto-cobro";
import type { TarjetaCalculo } from "./motor";

/**
 * Capa determinística de DNX Bot, parte del trabajo (spec §5.5 y §6.2). PURA. No tiene fórmulas:
 * cada concepto pasa por `armarItemsDelAsistente`, el mismo adaptador del botón «Armar con
 * ¿Cuánto Cobro?» del editor, así el borrador del bot se reabre en el panel de siempre. Un precio
 * total elegido a mano se reparte entre los conceptos y cada ítem se recalcula con
 * `recalcularItemCalculo` (lo mismo que hace el servidor al guardar) como precio ajustado.
 * Los totales son sumas de lo que devolvió el motor por concepto.
 */

// ── Entrada que puede llenar el modelo ─────────────────────────────────────────────────────────

const horas = z.string().regex(/^\d{1,4}([.,]\d{1,2})?$/).describe("Horas, sólo el número (\"8\", \"1,5\").");
const monto = z.string().regex(/^\d{1,12}$/).describe("Monto en pesos, sólo dígitos (sin $, puntos ni comas).");
const pct = z.string().regex(/^\d{1,3}([.,]\d{1,2})?$/).describe("Porcentaje, sólo el número (\"30\").");

export const esquemaTrabajoBot = z
  .object({
    nombre: z.string().min(1).max(120).describe("Nombre del concepto como lo diría el presupuesto (\"Cobertura\", \"Álbum\")."),
    tipo: z
      .enum(["own-service", "physical-product", "outsourced", "expense"])
      .optional()
      .describe("own-service = horas propias (por omisión); physical-product = álbum, impresiones; outsourced = trabajo tercerizado; expense = gasto o viático."),
    cantidad: z.string().regex(/^\d{1,6}$/).optional().describe("Unidades que cubre (informativo)."),
    horasCobertura: horas.optional(),
    horasEdicion: horas.optional(),
    horasEntrega: horas.optional(),
    horasViaje: horas.optional(),
    costoDirecto: monto.optional().describe("Costos directos del servicio propio (traslados, insumos)."),
    costoProveedor: monto.optional().describe("Lo que cobra el proveedor por el producto (laboratorio, imprenta)."),
    horasDiseno: horas.optional().describe("Horas propias de diseño o producción del producto."),
    costoEnvio: monto.optional(),
    costoTercerizado: monto.optional().describe("Lo que cobra quien hace el trabajo tercerizado."),
    horasGestion: horas.optional().describe("Horas propias de gestión de lo tercerizado."),
    costoGasto: monto.optional().describe("Monto del gasto o viático."),
    margenDeseado: pct.optional().describe("Ganancia deseada para producto, tercerizado o gasto. Sólo si la persona la dijo."),
    horasCliente: horas.optional().describe("Horas con el cliente (ventas, reuniones, coordinación) del trabajo entero: van sólo en el primer concepto."),
  })
  .describe("Un concepto del trabajo. Todo número tiene que haberlo dicho la persona: si falta, dejalo vacío.");

export type TrabajoBot = z.infer<typeof esquemaTrabajoBot>;

export const esquemaCotizacion = z.object({
  tipoDeTrabajo: z.string().min(1).max(80).describe("Tipo de trabajo (\"Casamiento\", \"Quince\", \"Retrato corporativo\")."),
  conceptos: z.array(esquemaTrabajoBot).min(1).max(10),
  precioTotalElegido: monto.optional().describe("Sólo si la persona fija un total a mano (\"dejalo en 1.100.000\" → \"1100000\")."),
});

export type Cotizacion = z.infer<typeof esquemaCotizacion>;

export function trabajoBotAPanel(t: TrabajoBot): TrabajoPanel {
  const h = (v: string | undefined) => (v ?? "").replace(",", ".");
  return {
    ...trabajoVacio(t.nombre),
    tipo: t.tipo ?? "own-service",
    cantidad: t.cantidad ?? "1",
    horasCobertura: h(t.horasCobertura),
    horasEdicion: h(t.horasEdicion),
    horasEntrega: h(t.horasEntrega),
    horasViaje: h(t.horasViaje),
    costoDirecto: t.costoDirecto ?? "",
    costoProveedor: t.costoProveedor ?? "",
    horasDiseno: h(t.horasDiseno),
    costoEnvio: t.costoEnvio ?? "",
    costoTercerizado: t.costoTercerizado ?? "",
    horasGestion: h(t.horasGestion),
    costoGasto: t.costoGasto ?? "",
    margenDeseado: h(t.margenDeseado),
    horasCliente: h(t.horasCliente),
  };
}

// ── Reparto de un total elegido a mano ─────────────────────────────────────────────────────────

/** En proporción al precio sugerido de cada concepto, en pesos enteros; el último absorbe el redondeo. */
export function repartirTotal(sugeridos: readonly number[], total: number): number[] {
  if (sugeridos.length === 0) return [];
  const base = sugeridos.reduce((s, x) => s + Math.max(0, x), 0);
  const partes = sugeridos.map((x) => Math.floor(base > 0 ? (total * Math.max(0, x)) / base : total / sugeridos.length));
  const asignado = partes.slice(0, -1).reduce((s, x) => s + x, 0);
  partes[partes.length - 1] = total - asignado;
  return partes;
}

// ── Cotizar ────────────────────────────────────────────────────────────────────────────────────

export type ResumenCotizacion = {
  conceptos: {
    nombre: string;
    precio: string;
    precioMinimo: string;
    precioRecomendado: string;
    horas: string;
    costo: string;
    ganancia: string;
    gananciaPct: string | null;
    estado: string;
    advertencias: string[];
  }[];
  total: { recomendado: string; minimo: string; elegido: string; ganancia: string; gananciaPct: string | null };
  /** El total quedó a mano (distinto del recomendado). */
  ajustado: boolean;
  valorHora: string;
  posicionamiento: string;
};

export type ResultadoCotizacion =
  | { estado: "PERFIL_INCOMPLETO"; faltan: string[] }
  | { estado: "FALTAN_DATOS" | "INVALIDO"; faltan: string[]; error: string }
  | { estado: "OK"; faltan: []; items: ItemPresupuesto[]; resumen: ResumenCotizacion };

const ESTADO: Record<string, string> = {
  loss: "pierde plata",
  tight: "ajustado",
  profitable: "rentable",
  unknown: "sin datos",
};

const porcentaje = (p: number | null) => (p === null || !Number.isFinite(p) ? null : `${Math.round(p * 100)} %`);
const horasTexto = (h: number) => `${Math.round(h * 10) / 10} h`;

function resumir(items: ItemPresupuesto[], ajustado: boolean): ResumenCotizacion {
  const calc = items.map((i) => i.calculo!);
  const moneda = calc[0]?.moneda || "ARS";
  const $ = (n: number) => formatCuantoCobroCurrency(n, moneda);
  const suma = (f: (c: (typeof calc)[number]) => number) => calc.reduce((s, c) => s + f(c), 0);
  const costoBase = suma((c) => c.costoBase);
  const ganancia = suma((c) => c.margenElegido);
  return {
    conceptos: items.map((it) => {
      const c = it.calculo!;
      return {
        nombre: it.nombre,
        precio: $(c.precioElegido),
        precioMinimo: $(c.precioMinimo),
        precioRecomendado: $(c.precioSugerido),
        horas: horasTexto(c.horasTotales),
        costo: $(c.costoBase),
        ganancia: $(c.margenElegido),
        gananciaPct: porcentaje(c.margenElegidoProporcion),
        estado: ESTADO[c.estadoRentabilidad] ?? c.estadoRentabilidad,
        advertencias: c.advertencias,
      };
    }),
    total: {
      recomendado: $(suma((c) => c.precioSugerido)),
      minimo: $(suma((c) => c.precioMinimo)),
      elegido: $(suma((c) => c.precioElegido)),
      ganancia: $(ganancia),
      gananciaPct: porcentaje(costoBase > 0 ? ganancia / costoBase : null),
    },
    ajustado,
    valorHora: $(calc[0]?.valorHora ?? 0),
    posicionamiento: calc[0]?.posicionamiento ?? "",
  };
}

/**
 * El precio de un trabajo descripto en palabras. Sin perfil completo no hay precio. Los ítems que
 * devuelve son exactamente los que agregaría el panel (`armarItemsDelAsistente`): ítems CALCULO
 * con su instantánea y la entrada del motor, listos para el borrador.
 */
export function cotizar(
  perfil: CuantoCobroProfileInput,
  c: Cotizacion,
  opciones: { nuevaClave: () => string; ahora?: Date; seccion?: string | null },
): ResultadoCotizacion {
  const p = resumirPerfil(perfil);
  if (!p.completo) return { estado: "PERFIL_INCOMPLETO", faltan: p.faltan };

  const r = armarItemsDelAsistente(perfil, c.conceptos.map(trabajoBotAPanel), c.tipoDeTrabajo, {
    nuevaClave: opciones.nuevaClave,
    ahora: opciones.ahora,
    seccion: opciones.seccion ?? null,
  });
  if (!r.ok) return { estado: r.faltan.length ? "FALTAN_DATOS" : "INVALIDO", faltan: r.faltan, error: r.error };

  if (c.precioTotalElegido === undefined) return { estado: "OK", faltan: [], items: r.items, resumen: resumir(r.items, false) };

  const total = parseCuantoCobroAmount(c.precioTotalElegido) ?? 0;
  if (!(total > 0)) return { estado: "INVALIDO", faltan: [], error: "El precio elegido tiene que ser mayor que cero." };
  const partes = repartirTotal(r.items.map((i) => i.calculo!.precioSugerido), total);
  const items: ItemPresupuesto[] = [];
  for (let i = 0; i < r.items.length; i += 1) {
    const it = r.items[i]!;
    const entrada = entradaDelMotor(it.calculo!.entrada);
    if (!entrada) return { estado: "INVALIDO", faltan: [], error: "Los datos del cálculo de ¿Cuánto Cobro? no son válidos." };
    const re = recalcularItemCalculo({ ...it, precioUnitario: partes[i]! }, entrada, opciones.ahora, { precioAjustado: true });
    if (!re.ok) return { estado: "INVALIDO", faltan: re.faltan, error: `${it.nombre}: ${re.error}` };
    items.push(re.item);
  }
  return { estado: "OK", faltan: [], items, resumen: resumir(items, true) };
}

// ── Tarjeta «cálculo» ──────────────────────────────────────────────────────────────────────────

export function tarjetaDeCotizacion(r: ResumenCotizacion, tipoDeTrabajo: string): TarjetaCalculo {
  const t = r.total;
  const filas = [
    { etiqueta: "Precio", valor: t.elegido },
    ...(r.ajustado ? [{ etiqueta: "Recomendado", valor: t.recomendado }] : []),
    { etiqueta: "Mínimo para no perder", valor: t.minimo },
    { etiqueta: "Ganancia", valor: t.gananciaPct ? `${t.ganancia} (${t.gananciaPct})` : t.ganancia },
    { etiqueta: "Valor hora", valor: r.valorHora },
    ...r.conceptos.map((c) => ({ etiqueta: c.nombre, valor: c.precio })),
  ].slice(0, 12);
  const avisos = [
    ...r.conceptos.filter((c) => c.estado === "pierde plata").map((c) => `${c.nombre}: con este precio pierde plata.`),
    ...new Set(r.conceptos.flatMap((c) => c.advertencias)),
  ].slice(0, 6);
  return { titulo: `¿Cuánto cobro? · ${tipoDeTrabajo}`.slice(0, 80), filas, avisos };
}
