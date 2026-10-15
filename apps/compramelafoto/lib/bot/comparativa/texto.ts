import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import type { Cotizacion } from "./dolar";
import type { Periodo, TipoComparativa } from "./periodos";

export type UsoAudiencia = { costoMicroUsd: number; conversaciones: number; mensajes: number };
/** `pesos` son pesos enteros (Order.totalCents de CLF son pesos, no centavos). */
export type Ventas = { pedidos: number; pesos: number };

export type DatosComparativa = {
  tipo: TipoComparativa;
  actual: Periodo;
  anterior: Periodo;
  /** Sólo en la mensual: los 3 meses previos al informado. */
  promedioPrevios?: Ventas;
  /** Costo total del período (incluye las filas `ip:`, que hoy cuestan 0). */
  costoTotalMicroUsd: number;
  fotografos: UsoAudiencia;
  compradores: UsoAudiencia;
  ventasActual: Ventas;
  ventasAnterior: Ventas;
  /** Pedidos pagados hasta 48 h después de una conversación de comprador (regla de `ventasPosteriores`). */
  ayudaCompradores: Ventas;
  ayudaFotografos: { hablaron: number; vendieron: number; pedidos: number; pesos: number; ventanaAbierta: boolean };
  primerasVentas: { fotografos: number; hablaronConElBot: number };
  cotizacion: Cotizacion | null;
  /** El período todavía no terminó (envío forzado antes de tiempo). */
  parcial: boolean;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function ddmm(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}
function rango(p: Periodo) {
  return `del ${ddmm(p.desde)} al ${ddmm(p.hasta)}/${p.hasta.slice(0, 4)}`;
}
function nombreMes(p: Periodo) {
  return `${MESES[Number(p.desde.slice(5, 7)) - 1]} ${p.desde.slice(0, 4)}`;
}
function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}
function num(n: number, decimales: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}
function usd(microUsd: number) {
  return `USD ${num(microUsd / 1_000_000, 2)}`;
}
function cambio(actual: number, anterior: number): string {
  if (anterior === 0) return actual === 0 ? "sin cambio" : "sin base para comparar";
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return `${pct > 0 ? "+" : ""}${pct} %`;
}
function ventas(v: Ventas) {
  return `${plural(v.pedidos, "pedido", "pedidos")}, ${formatPurchaseArs(v.pesos)}`;
}
function uso(nombre: string, u: UsoAudiencia) {
  return `${nombre}: ${usd(u.costoMicroUsd)}, ${plural(u.conversaciones, "conversación", "conversaciones")}, ${plural(u.mensajes, "mensaje", "mensajes")}`;
}

/** Texto plano para Telegram (sin markdown), en voseo y con líneas cortas. Determinístico. */
export function formatearComparativa(d: DatosComparativa): string {
  const l: string[] = [];
  l.push("🤖 DNX Bot · CLF · costo vs ventas");
  if (d.tipo === "fin_de_semana") {
    l.push(`Período: ${rango(d.actual)} (${d.actual.dias} días, con el bot abierto a todos).`);
    l.push(`Comparado con: ${rango(d.anterior)} (los ${d.anterior.dias} días anteriores).`);
  } else {
    l.push(`Período: ${nombreMes(d.actual)}.`);
    l.push(`Comparado con: ${nombreMes(d.anterior)}.`);
    l.push("Y con el promedio de los 3 meses anteriores.");
  }
  if (d.parcial) l.push("Ojo: el período no terminó, los números son parciales.");

  l.push("");
  l.push(`Costo del bot: ${usd(d.costoTotalMicroUsd)} (dólares reales, se factura en USD).`);
  if (d.cotizacion) {
    const pesos = Math.round((d.costoTotalMicroUsd / 1_000_000) * d.cotizacion.pesosPorDolar);
    const dolar = formatPurchaseArs(d.cotizacion.pesosPorDolar);
    const fuente = d.cotizacion.fuente === "dolarapi" ? `dólar tarjeta ${dolar}, dolarapi.com` : `dólar ${dolar}, de CLF_BOT_USD_ARS`;
    l.push(`En pesos: ${formatPurchaseArs(pesos)} (${fuente}).`);
  }
  l.push(uso("Fotógrafos", d.fotografos) + ".");
  l.push(uso("Compradores", d.compradores) + ".");

  l.push("");
  l.push("Ventas de CLF (fecha: creación del pedido):");
  l.push(`Este período: ${ventas(d.ventasActual)}.`);
  l.push(`Período anterior: ${ventas(d.ventasAnterior)}.`);
  l.push(
    `Cambio: ${cambio(d.ventasActual.pedidos, d.ventasAnterior.pedidos)} en pedidos, ` +
      `${cambio(d.ventasActual.pesos, d.ventasAnterior.pesos)} en pesos.`,
  );
  if (d.promedioPrevios) {
    l.push(`Promedio de los 3 meses anteriores: ${ventas(d.promedioPrevios)}.`);
    l.push(`Contra ese promedio: ${cambio(d.ventasActual.pesos, d.promedioPrevios.pesos)} en pesos.`);
  }

  l.push("");
  l.push("Ventas que el bot pudo haber ayudado:");
  l.push(`Compradores: ${ventas(d.ayudaCompradores)} (hasta 48 h después del bot).`);
  const f = d.ayudaFotografos;
  l.push(`Fotógrafos: ${f.vendieron} de ${f.hablaron} que usaron el bot vendieron en 30 días.`);
  l.push(`Son ${ventas({ pedidos: f.pedidos, pesos: f.pesos })}${f.ventanaAbierta ? " (la ventana sigue abierta)" : ""}.`);
  l.push(
    `Primera venta de su vida: ${plural(d.primerasVentas.fotografos, "fotógrafo", "fotógrafos")} ` +
      `(${d.primerasVentas.hablaronConElBot} usaron el bot).`,
  );

  l.push("");
  if (d.cotizacion && d.ventasActual.pesos > 0) {
    const pesos = (d.costoTotalMicroUsd / 1_000_000) * d.cotizacion.pesosPorDolar;
    const pct = (pesos / d.ventasActual.pesos) * 100;
    l.push(`El bot costó el ${num(pct, 2)} % de las ventas. Es correlación, no prueba.`);
  } else {
    l.push("Sin dólar o sin ventas no hay %. Es correlación, no prueba.");
  }
  return l.join("\n");
}
