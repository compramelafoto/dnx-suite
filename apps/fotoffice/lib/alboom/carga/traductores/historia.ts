import { huella } from "../../huella";
import { MOTIVOS } from "../campos";
import { campos, clave, fecha, idAlboom, importe, texto, textoLargo } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Piezas comunes de los traductores de la 8B-2 (lo histórico: consultas, presupuestos, pedidos, cobros, contratos,
 * proyectos, agenda y finanzas). Puro: sin base ni código de servidor.
 *
 * Regla de lo histórico: una vez cargado, un registro NO se vuelve a actualizar desde Alboom (Alboom quedó como
 * respaldo de sólo lectura desde el 19/10/2026 y en FOTOFFICE el estudio ya lo puede haber editado). Cargar dos veces
 * nunca duplica: el mapa ata cada id de Alboom a su registro.
 */

/** Desde este día DNX Estudio opera en FOTOFFICE (Caja, pedidos y mostrador reales). */
export const CORTE_FOTOFFICE = "2026-10-19";

export const ACTOR_ALBOOM = "Migración desde Alboom";

/** Motivos fijos de la 8B-2 (nunca llevan datos del registro). */
export const MOTIVOS_8B2 = {
  contactoSinCargar: "Su contacto no se cargó",
  consultaSinCargar: "Su consulta (oportunidad) no se cargó",
  categoriaSinCargar: "Su categoría no se cargó",
  pedidoSinCargar: "Su pedido no se cargó",
  proyectoSinCargar: "Su proyecto no se cargó",
  flujoSinCargar: "Su flujo de trabajo no se emparejó",
  sinPedido: "Sin pedido: no tiene lugar en FOTOFFICE (queda en el crudo de Alboom)",
  importeCero: "Importe en cero",
  cuotaDelPedido: "Ya está en el plan de cuotas del pedido",
  cubiertoPorCosto: "Ya se cargó como costo del pedido",
  sinTexto: "Sin texto",
  sinTitulo: "Sin título",
  sinFecha: "Sin fecha",
  sinDestino: "Sin destino en FOTOFFICE (queda en el crudo de Alboom)",
} as const;

export const DUDAS_8B2 = {
  cambioEnAlboom: "Cambió en Alboom después de cargarlo (no se actualiza: es histórico)",
  sinEtapa: "Su etapa no se emparejó: quedó en la primera del circuito",
  sinCircuito: "Su embudo no se emparejó: quedó sin recorrido",
  pedidoAbierto: "Pedido abierto en Alboom (no se había confirmado la venta): quedó Confirmado",
  numeroOcupado: "El número de Alboom ya lo usa otro registro: quedó con ALB- adelante",
  totalDistinto: "El total recalculado no coincide con el de Alboom (se guardó el de Alboom)",
  presupuestoUsado: "El presupuesto ya tiene otro pedido: se cargó sin presupuesto",
  medioDesconocido: "Medio de pago desconocido (quedó Otro)",
  sinCuotas: "El pedido no tiene cuotas con saldo: el cobro quedó sin imputar",
  fechaFin: "La cita terminaba antes de empezar: quedó de una hora",
  tipoCitaSinCargar: "Tipo de cita sin equivalente (quedó sin tipo)",
  rolSinCargar: "Rol sin equivalente (quedó sin rol)",
  firmaSinFecha: "Firmado en Alboom sin fecha de firma (se usó la de modificación)",
  enviadoSinFirmar: "Enviado en Alboom y sin firmar: quedó en borrador (sin enlace)",
  pagoSinFecha: "Pagado en Alboom sin fecha de pago (se usó el vencimiento)",
  itemsDelListado: "El detalle no traía ítems: se usó lo del listado",
} as const;

/** Lo que vale para todo registro histórico ya cargado. `null` = no está en el mapa (seguir traduciendo). */
export function yaCargado(c: Crudo, mapa: EntradaMapa | undefined, existe: (id: string) => boolean): Decision | null {
  if (!mapa) return null;
  if (!existe(mapa.targetId)) return { accion: "OMITIR", motivo: MOTIVOS.borradoEnFotoffice };
  if (mapa.payloadHash === c.hash) return { accion: "IGUAL", targetId: mapa.targetId, escribirMapa: false };
  return { accion: "IGUAL", targetId: mapa.targetId, huellas: mapa.fieldHashes, dudas: [DUDAS_8B2.cambioEnAlboom] };
}

/** Id del padre de un hijo de la 8A ("<idPadre>/<id>"). */
export function padreDe(alboomId: string): string | null {
  const i = alboomId.indexOf("/");
  return i > 0 ? idAlboom(alboomId.slice(0, i)) : null;
}

/**
 * Instante de una fecha-hora de Alboom ("aaaa-mm-dd hh:mm[:ss]", hora argentina = UTC−3, como guarda el panel) como
 * ISO UTC. Una fecha sola es el mediodía de Argentina (así nunca se corre de día). `null` si no se entiende.
 */
export function instanteAr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const dia = fecha(v);
  if (!dia) return null;
  const m = /^\s*\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(v);
  const [h, mi, se] = m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : [12, 0, 0];
  if (h > 23 || mi > 59 || se > 59) return null;
  const d = new Date(`${dia}T00:00:00.000Z`);
  d.setUTCHours(h + 3, mi, se, 0);
  return d.toISOString();
}

/** ¿Trae hora (no sólo el día, ni 00:00:00)? */
export function traeHora(v: unknown): boolean {
  return typeof v === "string" && /^\s*\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(v) && !/[ T]00:00(:00)?\s*$/.test(v);
}

export type Medio = "EFECTIVO" | "TRANSFERENCIA" | "MERCADO_PAGO" | "TARJETA" | "OTRO";

/** Medio de pago de FOTOFFICE para el nombre del método de Alboom (doc 09: Efectivo, Transferencia…). */
export function medioDePago(nombre: unknown): { medio: Medio; conocido: boolean } {
  const t = typeof nombre === "string" ? clave(nombre) : "";
  if (!t) return { medio: "OTRO", conocido: false };
  if (t.includes("mercado pago") || /\bmp\b/.test(t)) return { medio: "MERCADO_PAGO", conocido: true };
  if (t.includes("efectivo") || t.includes("contado")) return { medio: "EFECTIVO", conocido: true };
  if (t.includes("transferencia") || t.includes("deposito") || t.includes("banco")) return { medio: "TRANSFERENCIA", conocido: true };
  if (t.includes("tarjeta") || t.includes("credito") || t.includes("debito") || t.includes("uala") || t.includes("visa")) return { medio: "TARJETA", conocido: true };
  if (t.includes("cheque") || t.includes("paypal") || t.includes("otro")) return { medio: "OTRO", conocido: true };
  return { medio: "OTRO", conocido: false };
}

/** Importe con signo de un asiento (`account_trans.amount` es negativo en una cuenta a cobrar o un depósito). */
export function importeConSigno(v: unknown): { valor: string; negativo: boolean } | null {
  if (typeof v === "number") return Number.isFinite(v) ? { valor: Math.abs(v).toFixed(2), negativo: v < 0 } : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  const negativo = t.startsWith("-") || (t.startsWith("(") && t.endsWith(")"));
  const valor = importe(t.replace(/^[-(]+|\)$/g, ""));
  return valor === null ? null : { valor, negativo };
}

/** HTML de Alboom (contratos, correos) → texto plano con saltos de línea. */
export function htmlATexto(v: unknown, max = 200_000): string | null {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/\r\n?/g, "\n")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Huella corta de un dato sensible (IP, imagen de la firma): sirve de evidencia sin guardar el dato. */
export const huellaDato = (v: string) => huella(`dato:${v}`).slice(0, 32);

/** Renglón "Etiqueta: valor" para la nota de la ficha, o nada si no hay valor. */
export function renglon(etiqueta: string, v: unknown, max = 500): string[] {
  const t = typeof v === "string" ? textoLargo(v, max) : texto(v, max);
  return t ? [`${etiqueta}: ${t}`] : [];
}

/** Nota "Datos de Alboom" con lo que no tiene columna en FOTOFFICE (o `null` si no hay nada). */
export function notaDeAlboom(titulo: string, renglones: string[]): string | null {
  return renglones.length ? `${titulo}\n${renglones.join("\n")}` : null;
}

/** Mapa id de Alboom → payload de una entidad, para los contextos. */
export function porId(crudos: { alboomId: string; payload: unknown }[]): Map<string, Record<string, unknown>> {
  return new Map(crudos.map((c) => [c.alboomId, campos(c.payload)]));
}

/** Hijos agrupados por el id del padre ("<idPadre>/<id>"). */
export function porPadre(crudos: { alboomId: string; payload: unknown }[]): Map<string, { alboomId: string; p: Record<string, unknown> }[]> {
  const m = new Map<string, { alboomId: string; p: Record<string, unknown> }[]>();
  for (const c of crudos) {
    const padre = padreDe(c.alboomId);
    if (!padre) continue;
    m.set(padre, [...(m.get(padre) ?? []), { alboomId: c.alboomId, p: campos(c.payload) }]);
  }
  return m;
}

/** Id de usuario de FOTOFFICE (número) desde el mapa de usuarios. */
export function usuario(usuarioDe: Map<string, string>, v: unknown): number | null {
  const id = idAlboom(v);
  const u = id ? usuarioDe.get(id) : undefined;
  const n = u ? Number(u) : NaN;
  return Number.isInteger(n) ? n : null;
}
