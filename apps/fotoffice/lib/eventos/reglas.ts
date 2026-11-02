/**
 * Reglas puras del módulo de eventos: qué inscriptos salen de un pedido, el código para la
 * puerta, la búsqueda y la planilla. Sin base: se prueban solas.
 */
import { ESTADO_PAGO_LABEL, ORIGEN_LABEL, type EstadoPago, type Origen } from "./constants";

/** Sin 0/O, 1/I/L: se dicta en la puerta y no tiene que confundir. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generarCodigo(azar: () => number = Math.random, largo = 6): string {
  let out = "";
  for (let i = 0; i < largo; i++) out += ALFABETO[Math.floor(azar() * ALFABETO.length)];
  return out;
}

export type ItemPedido = {
  id: string;
  productId: string | null;
  productName: string;
  variantName: string | null;
  qty: number;
  unitPriceArs: string;
};

export type EntradaEvento = { eventoId: string; productId: string; tipo: string | null };

export type UnidadEntrada = {
  eventoId: string;
  storeOrderItemId: string;
  unidad: number;
  tipo: string;
  montoArs: string;
};

/**
 * Cada unidad de un producto que es entrada a un evento es un inscripto: tres entradas en un
 * mismo ítem son tres personas (la 1 queda a nombre de quien compró; las otras también, hasta
 * que se corrija el nombre a mano). Los productos que no son entradas no cuentan.
 */
export function unidadesDeEntrada(items: ItemPedido[], entradas: EntradaEvento[]): UnidadEntrada[] {
  const porProducto = new Map(entradas.map((e) => [e.productId, e]));
  const out: UnidadEntrada[] = [];
  for (const it of items) {
    const entrada = it.productId ? porProducto.get(it.productId) : undefined;
    if (!entrada) continue;
    const cantidad = Math.max(0, Math.min(Math.floor(it.qty), 200));
    const tipo = entrada.tipo?.trim() || [it.productName, it.variantName].filter(Boolean).join(" · ");
    for (let u = 1; u <= cantidad; u++) {
      out.push({ eventoId: entrada.eventoId, storeOrderItemId: it.id, unidad: u, tipo, montoArs: it.unitPriceArs });
    }
  }
  return out;
}

/** Minúsculas y sin tildes, para buscar "jose" y encontrar "José". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export type InscriptoBuscable = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  codigo: string;
};

/** Coincide si cada palabra buscada está en algún dato (nombre, correo, teléfono, DNI o código). */
export function coincide(i: InscriptoBuscable, consulta: string): boolean {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const pajar = [normalizar(i.nombre), normalizar(i.email), digitos(i.telefono), digitos(i.dni), normalizar(i.codigo)].join(" ");
  return palabras.every((p) => pajar.includes(p));
}

export type InscriptoPlanilla = InscriptoBuscable & {
  tipo: string | null;
  origen: string;
  estadoPago: string;
  montoArs: string | null;
  acreditadoAt: Date | null;
  createdAt: Date;
  notas: string | null;
};

function celda(v: string): string {
  // Una celda que empieza con = + - @ se toma como fórmula en Excel: se le antepone un apóstrofo.
  const seguro = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

function fechaAr(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
}

/** Planilla con punto y coma (Excel en castellano la abre directo) y BOM para las tildes. */
export function planillaInscriptos(filas: InscriptoPlanilla[]): string {
  const encabezado = ["Código", "Nombre", "Correo", "Teléfono", "DNI", "Entrada", "Origen", "Pago", "Monto", "Acreditado", "Anotado", "Notas"];
  const lineas = filas.map((f) =>
    [
      f.codigo,
      f.nombre,
      f.email ?? "",
      f.telefono ?? "",
      f.dni ?? "",
      f.tipo ?? "",
      ORIGEN_LABEL[f.origen as Origen] ?? f.origen,
      ESTADO_PAGO_LABEL[f.estadoPago as EstadoPago] ?? f.estadoPago,
      f.montoArs ?? "",
      fechaAr(f.acreditadoAt),
      fechaAr(f.createdAt),
      f.notas ?? "",
    ]
      .map(celda)
      .join(";"),
  );
  return "﻿" + [encabezado.join(";"), ...lineas].join("\r\n");
}

export type Resumen = { total: number; pagados: number; pendientes: number; cortesias: number; acreditados: number };

export function resumir(filas: { estadoPago: string; acreditadoAt: Date | null }[]): Resumen {
  const r: Resumen = { total: 0, pagados: 0, pendientes: 0, cortesias: 0, acreditados: 0 };
  for (const f of filas) {
    if (f.estadoPago === "ANULADO") continue;
    r.total++;
    if (f.estadoPago === "PAGADO") r.pagados++;
    else if (f.estadoPago === "PENDIENTE") r.pendientes++;
    else if (f.estadoPago === "CORTESIA") r.cortesias++;
    if (f.acreditadoAt) r.acreditados++;
  }
  return r;
}

/** A quién se le da diploma en un evento. */
export const DIPLOMA_PARA = ["ACREDITADOS", "PAGADOS", "TODOS"] as const;
export type DiplomaPara = (typeof DIPLOMA_PARA)[number];
export const DIPLOMA_PARA_LABEL: Record<DiplomaPara, string> = {
  ACREDITADOS: "Sólo a los acreditados en la puerta",
  PAGADOS: "A los pagados y cortesías",
  TODOS: "A todos los inscriptos",
};

export function esDiplomaPara(v: unknown): v is DiplomaPara {
  return typeof v === "string" && (DIPLOMA_PARA as readonly string[]).includes(v);
}

/** Si a este inscripto le corresponde diploma. Un anulado nunca, aunque se haya acreditado. */
export function tieneDiploma(i: { estadoPago: string; acreditadoAt: Date | null }, para: string): boolean {
  if (i.estadoPago === "ANULADO") return false;
  if (para === "TODOS") return true;
  if (para === "PAGADOS") return i.estadoPago === "PAGADO" || i.estadoPago === "CORTESIA" || i.acreditadoAt !== null;
  return i.acreditadoAt !== null;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function partesAr(d: Date) {
  const [a, m, dia] = d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).split("-").map(Number);
  return { a, m, dia };
}

/**
 * La fecha del evento escrita como en un diploma: "1 de noviembre de 2026", "1 y 2 de noviembre
 * de 2026", "31 de octubre al 3 de noviembre de 2026". Sin fecha: "".
 */
export function fechaDeEvento(inicio: Date | null, fin: Date | null): string {
  if (!inicio) return "";
  const i = partesAr(inicio);
  if (!fin) return `${i.dia} de ${MESES[i.m - 1]} de ${i.a}`;
  const f = partesAr(fin);
  if (i.a === f.a && i.m === f.m && i.dia === f.dia) return `${i.dia} de ${MESES[i.m - 1]} de ${i.a}`;
  if (i.a === f.a && i.m === f.m) {
    return f.dia - i.dia === 1 ? `${i.dia} y ${f.dia} de ${MESES[i.m - 1]} de ${i.a}` : `${i.dia} al ${f.dia} de ${MESES[i.m - 1]} de ${i.a}`;
  }
  if (i.a === f.a) return `${i.dia} de ${MESES[i.m - 1]} al ${f.dia} de ${MESES[f.m - 1]} de ${f.a}`;
  return `${i.dia} de ${MESES[i.m - 1]} de ${i.a} al ${f.dia} de ${MESES[f.m - 1]} de ${f.a}`;
}
