/**
 * Cuánto le toca a cada uno en una venta de un curso. Puro: sin base, sin red.
 *
 * Lo usan el simulador (en el navegador), el cobro y los tests: lo que ve el dueño mientras carga
 * el precio es exactamente lo que después se cobra (spec del mercado de cursos, sección 2).
 *
 * Reglas:
 * - El 5% de la plataforma se calcula sobre el precio de LISTA y se cobra encima al comprador.
 * - Con reventa, el % del revendedor sale de arriba y el resto se reparte entre los beneficiarios.
 * - El descuento sale sólo de la parte de quien vende (el revendedor, o el beneficiario que vende)
 *   y nunca la supera.
 * - Los centavos que sobran por redondeo van a quien absorbe la comisión de Mercado Pago.
 * - La comisión de Mercado Pago no la calcula el motor: la descuenta MP al acreditar.
 */

export const BPS_TOTAL = 10000;
/** El dueño de la orden de Mercado Pago más hasta 10 socios del split. */
export const MAX_RECEPTORES_SPLIT = 11;

export type BeneficiarioEntrada = { id: string; nombre: string; bps: number; absorbeMp: boolean };

export type ParteDelReparto = {
  id: string;
  nombre: string;
  tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  centavos: number;
  absorbeMp: boolean;
};

export type EntradaReparto = {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  reventa?: { id: string; nombre: string; bps: number } | null;
  descuentoBps?: number;
  /** Sin reventa: el beneficiario que vende, de cuya parte sale el descuento. */
  vendedorId?: string | null;
};

export type ResultadoReparto =
  | { ok: true; pagaElAlumno: number; comisionPlataforma: number; descuento: number; partes: ParteDelReparto[] }
  | { ok: false; errores: string[] };

export function formatoPorcentaje(bps: number): string {
  const valor = bps / 100;
  return `${Number.isInteger(valor) ? valor : valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

function porcion(centavos: number, bps: number): number {
  return Math.round((centavos * bps) / BPS_TOTAL);
}

export function topeDeDescuentoBps(e: Pick<EntradaReparto, "beneficiarios" | "reventa" | "vendedorId">): number {
  if (e.reventa) return e.reventa.bps;
  return e.beneficiarios.find((b) => b.id === e.vendedorId)?.bps ?? 0;
}

function validar(e: EntradaReparto): string[] {
  const errores: string[] = [];
  if (!Number.isInteger(e.listaCentavos) || e.listaCentavos <= 0) {
    errores.push("El precio de lista tiene que ser mayor que cero.");
  }
  if (!Number.isInteger(e.comisionPlataformaBps) || e.comisionPlataformaBps < 0 || e.comisionPlataformaBps > BPS_TOTAL) {
    errores.push("La comisión de la plataforma no es válida.");
  }
  if (e.beneficiarios.length === 0) {
    errores.push("Tiene que haber al menos un beneficiario.");
  } else if (e.beneficiarios.some((b) => !Number.isInteger(b.bps) || b.bps <= 0)) {
    errores.push("Cada beneficiario tiene que tener un porcentaje mayor que cero.");
  } else {
    const suma = e.beneficiarios.reduce((s, b) => s + b.bps, 0);
    if (suma !== BPS_TOTAL) errores.push(`Los porcentajes suman ${formatoPorcentaje(suma)}: tienen que sumar 100%.`);
  }
  if (e.beneficiarios.length > 0 && e.beneficiarios.filter((b) => b.absorbeMp).length !== 1) {
    errores.push("Un beneficiario, y sólo uno, tiene que absorber la comisión de Mercado Pago.");
  }
  if (e.beneficiarios.length + (e.reventa ? 1 : 0) > MAX_RECEPTORES_SPLIT) {
    errores.push(`Mercado Pago reparte entre ${MAX_RECEPTORES_SPLIT} cuentas como máximo, contando al revendedor.`);
  }
  if (e.reventa && (!Number.isInteger(e.reventa.bps) || e.reventa.bps <= 0 || e.reventa.bps >= BPS_TOTAL)) {
    errores.push("El porcentaje del revendedor no es válido.");
  }
  const descuentoBps = e.descuentoBps ?? 0;
  if (!Number.isInteger(descuentoBps) || descuentoBps < 0) {
    errores.push("El descuento no es válido.");
  } else {
    const tope = topeDeDescuentoBps(e);
    if (descuentoBps > tope) {
      errores.push(`El descuento no puede superar ${formatoPorcentaje(tope)}: es la parte de quien vende.`);
    }
  }
  return errores;
}

export function calcularReparto(e: EntradaReparto): ResultadoReparto {
  const errores = validar(e);
  if (errores.length > 0) return { ok: false, errores };

  const lista = e.listaCentavos;
  const comisionPlataforma = porcion(lista, e.comisionPlataformaBps);
  const descuentoPedido = porcion(lista, e.descuentoBps ?? 0);

  let aRepartir = lista;
  let revendedor: ParteDelReparto | null = null;
  if (e.reventa) {
    const parte = porcion(lista, e.reventa.bps);
    aRepartir = lista - parte;
    revendedor = { id: e.reventa.id, nombre: e.reventa.nombre, tipo: "REVENDEDOR", centavos: parte, absorbeMp: false };
  }

  const beneficiarios: ParteDelReparto[] = e.beneficiarios.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    tipo: "BENEFICIARIO",
    centavos: Math.floor((aRepartir * b.bps) / BPS_TOTAL),
    absorbeMp: b.absorbeMp,
  }));
  const sobrante = aRepartir - beneficiarios.reduce((s, p) => s + p.centavos, 0);
  beneficiarios.find((p) => p.absorbeMp)!.centavos += sobrante;

  // El descuento sale sólo de quien vende y nunca la supera (los redondeos no la dejan negativa).
  const deQuien = revendedor ?? beneficiarios.find((p) => p.id === e.vendedorId) ?? null;
  const descuento = deQuien ? Math.min(descuentoPedido, deQuien.centavos) : 0;
  if (deQuien) deQuien.centavos -= descuento;

  const partes: ParteDelReparto[] = [
    ...(revendedor ? [revendedor] : []),
    ...beneficiarios,
    { id: "plataforma", nombre: "Plataforma", tipo: "PLATAFORMA", centavos: comisionPlataforma, absorbeMp: false },
  ];
  return { ok: true, pagaElAlumno: lista - descuento + comisionPlataforma, comisionPlataforma, descuento, partes };
}
