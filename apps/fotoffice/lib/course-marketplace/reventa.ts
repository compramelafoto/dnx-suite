// lib/course-marketplace/reventa.ts
import { BPS_TOTAL, MAX_RECEPTORES_SPLIT, calcularReparto, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";

/**
 * Reglas de la reventa de un curso (spec del mercado de cursos, secciones 4.2 y 4.3). Puras: las
 * usan las acciones del servidor, los formularios del navegador y los tests.
 *
 * - El dueño ofrece el curso con un % sugerido. Un pedido hasta el sugerido queda ACTIVO al
 *   instante; por encima, PENDIENTE hasta que el dueño lo apruebe.
 * - El revendedor fija el descuento para sus socios, de 0 hasta su propio %: nunca toca la parte
 *   de los demás. Nunca llega a "gratis": su % es siempre menor que 100.
 * - Cualquiera de los dos pausa o termina; lo pausado lo reanuda quien lo pausó.
 */

export type EstadoReventa = "PENDIENTE" | "ACTIVO" | "PAUSADO" | "RECHAZADO" | "TERMINADO";
export type LadoReventa = "DUENO" | "REVENDEDOR";
export type AccionReventa = "APROBAR" | "RECHAZAR" | "PAUSAR" | "REANUDAR" | "TERMINAR";

/** Un acuerdo en estos estados impide pedir otro para el mismo curso. */
export const ESTADOS_VIGENTES: readonly EstadoReventa[] = ["PENDIENTE", "ACTIVO", "PAUSADO"];
export const ACCIONES_REVENTA: readonly AccionReventa[] = ["APROBAR", "RECHAZAR", "PAUSAR", "REANUDAR", "TERMINAR"];

/** El % sugerido más alto que puede fijar un dueño: algo tiene que quedar para los beneficiarios. */
export const TOPE_SUGERIDO_BPS = 9000;

/** "12,5" → 1250. Vacío o inválido → null. */
export function porcentajeABps(texto: string | null | undefined): number | null {
  const limpio = (texto ?? "").trim().replace(/\s*%$/, "");
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio.replace(",", ".")) * 100);
}

export function validarOferta(input: { ofrecido: boolean; sugeridoBps: number | null; grabadoConPrecio: boolean }): string[] {
  if (!input.ofrecido) return [];
  const errores: string[] = [];
  if (!input.grabadoConPrecio) errores.push("Sólo se ofrecen a otras instituciones los cursos grabados con precio.");
  const s = input.sugeridoBps;
  if (s === null || !Number.isInteger(s) || s <= 0 || s > TOPE_SUGERIDO_BPS) {
    errores.push(`El % sugerido para revendedores tiene que ser mayor que 0 y de hasta ${formatoPorcentaje(TOPE_SUGERIDO_BPS)}.`);
  }
  return errores;
}

export function validarDescuentoDeSocios(descuentoBps: number, parteBps: number): string[] {
  if (!Number.isInteger(descuentoBps) || descuentoBps < 0) return ["El descuento no es válido."];
  if (descuentoBps > parteBps) {
    return [`El descuento para tus socios no puede superar ${formatoPorcentaje(parteBps)}: es tu parte.`];
  }
  return [];
}

export function estadoAlPedir(pedidoBps: number, sugeridoBps: number): "ACTIVO" | "PENDIENTE" {
  return pedidoBps <= sugeridoBps ? "ACTIVO" : "PENDIENTE";
}

export function validarPedidoDeReventa(input: {
  pedidoBps: number | null;
  descuentoBps: number | null;
  ofrecido: boolean;
  sugeridoBps: number | null;
  esDueno: boolean;
  esBeneficiario: boolean;
  cantidadBeneficiarios: number;
  acuerdoVigente: boolean;
}): string[] {
  if (!input.ofrecido || input.sugeridoBps === null) return ["Este curso no se ofrece a otras instituciones."];
  if (input.esDueno) return ["No podés revender un curso de tu propio negocio."];
  if (input.esBeneficiario) return ["Tu negocio ya es beneficiario de este curso: cobra su parte de cada venta."];
  if (input.acuerdoVigente) return ["Ya tenés un acuerdo para este curso. Lo ves en tus acuerdos."];
  const errores: string[] = [];
  const pedido = input.pedidoBps;
  if (pedido === null || !Number.isInteger(pedido) || pedido <= 0 || pedido >= BPS_TOTAL) {
    errores.push("Tu % tiene que ser mayor que 0 y menor que 100%.");
  } else {
    errores.push(...validarDescuentoDeSocios(input.descuentoBps ?? 0, pedido));
  }
  // Sin filas, el dueño es el único beneficiario: cuenta como uno.
  if (Math.max(1, input.cantidadBeneficiarios) + 1 > MAX_RECEPTORES_SPLIT) {
    errores.push("Este curso ya reparte entre el máximo de cuentas que admite Mercado Pago.");
  }
  return errores;
}

export type CodigoReventa = "no-es-dueno" | "no-pendiente" | "no-activo" | "no-pausaste" | "ya-termino";

export function aplicarAccion(
  acuerdo: { status: EstadoReventa; pausadoPor: LadoReventa | null },
  accion: AccionReventa,
  lado: LadoReventa,
): { ok: true; status: EstadoReventa; pausadoPor: LadoReventa | null } | { ok: false; codigo: CodigoReventa } {
  const { status } = acuerdo;
  switch (accion) {
    case "APROBAR":
    case "RECHAZAR":
      if (lado !== "DUENO") return { ok: false, codigo: "no-es-dueno" };
      if (status !== "PENDIENTE") return { ok: false, codigo: "no-pendiente" };
      return { ok: true, status: accion === "APROBAR" ? "ACTIVO" : "RECHAZADO", pausadoPor: null };
    case "PAUSAR":
      if (status !== "ACTIVO") return { ok: false, codigo: "no-activo" };
      return { ok: true, status: "PAUSADO", pausadoPor: lado };
    case "REANUDAR":
      if (status !== "PAUSADO" || acuerdo.pausadoPor !== lado) return { ok: false, codigo: "no-pausaste" };
      return { ok: true, status: "ACTIVO", pausadoPor: null };
    case "TERMINAR":
      if (!ESTADOS_VIGENTES.includes(status)) return { ok: false, codigo: "ya-termino" };
      return { ok: true, status: "TERMINADO", pausadoPor: null };
  }
}

/** Textos fijos para el `?r=` de la página de acuerdos: la URL nunca aporta texto. */
const MENSAJES_DE_ACUERDOS: Record<string, string> = {
  aprobado: "Aprobaste el pedido: el acuerdo quedó activo.",
  rechazado: "Rechazaste el pedido.",
  pausado: "Pausaste el acuerdo. Mientras esté pausado, el curso no se vende por ese canal.",
  reanudado: "Reanudaste el acuerdo.",
  terminado: "Terminaste el acuerdo. Quienes ya compraron conservan su acceso.",
  descuento: "Guardaste el descuento para tus socios. Vale para las ventas nuevas.",
  "descuento-invalido": "El descuento para tus socios no puede superar tu parte.",
  "sin-permiso": "Sólo el dueño o un administrador del negocio puede cambiar un acuerdo.",
  "no-encontrado": "Ese acuerdo ya no está disponible.",
  "no-es-dueno": "Sólo el dueño del curso puede aprobar o rechazar un pedido.",
  "no-pendiente": "Ese pedido ya no está pendiente.",
  "no-activo": "Sólo se puede pausar un acuerdo activo.",
  "no-pausaste": "Lo reanuda quien lo pausó.",
  "ya-termino": "Ese acuerdo ya terminó.",
};

export function mensajeDeAcuerdos(codigo: string | undefined): string | null {
  if (!codigo || !Object.hasOwn(MENSAJES_DE_ACUERDOS, codigo)) return null;
  return MENSAJES_DE_ACUERDOS[codigo];
}

/**
 * Lo que ve una institución al pedir una reventa, en modo lectura: su parte por venta y cuánto
 * pagaría un socio suyo con el descuento elegido. Mismo motor que después cobra.
 */
// parteCentavos es la parte del revendedor antes del descuento para socios.
export function simularReventa(input: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  pedidoBps: number;
  descuentoBps: number;
}): { ok: true; parteCentavos: number; pagaElAlumno: number; pagaElSocio: number } | { ok: false; errores: string[] } {
  const base = {
    listaCentavos: input.listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: input.beneficiarios,
    reventa: { id: "revendedor", nombre: "Tu institución", bps: input.pedidoBps },
  };
  const publico = calcularReparto(base);
  if (!publico.ok) return publico;
  const socio = calcularReparto({ ...base, descuentoBps: input.descuentoBps });
  if (!socio.ok) return socio;
  const parte = publico.partes.find((p) => p.tipo === "REVENDEDOR")?.centavos ?? 0;
  return { ok: true, parteCentavos: parte, pagaElAlumno: publico.pagaElAlumno, pagaElSocio: socio.pagaElAlumno };
}
