/**
 * Por dónde sale el presupuesto aprobado (spec 2026-10-25 §3). Módulo PURO.
 *
 * - Correo: siempre que haya un correo válido.
 * - WhatsApp: sólo con celular, con la conexión con Meta en modo REAL (con token) y con la ventana
 *   de 24 h abierta (el cliente escribió hace menos de 24 h). Fuera de la ventana Meta exige
 *   plantillas pagas, que no se usan: queda anotado "ventana cerrada" y sale sólo el correo.
 */

export type MotivoSinWhatsapp = "SIN_CELULAR" | "SIN_CONEXION" | "VENTANA_CERRADA";

export type EntradaCanales = {
  correoValido: boolean;
  /** Teléfono ya convertido a WhatsApp (E.164 sin "+"), o null. */
  waId: string | null;
  /** Conexión de la Bandeja en modo REAL y con token. */
  whatsappConectado: boolean;
  /** Hay un chat con ese número y el último mensaje del cliente es de hace menos de 24 h. */
  ventanaAbierta: boolean;
};

export type DecisionCanales = { correo: boolean; whatsapp: boolean; motivoSinWhatsapp: MotivoSinWhatsapp | null };

export function decidirCanales(c: EntradaCanales): DecisionCanales {
  let motivo: MotivoSinWhatsapp | null = null;
  if (!c.waId) motivo = "SIN_CELULAR";
  else if (!c.whatsappConectado) motivo = "SIN_CONEXION";
  else if (!c.ventanaAbierta) motivo = "VENTANA_CERRADA";
  return { correo: c.correoValido, whatsapp: motivo === null, motivoSinWhatsapp: motivo };
}

/** Lo que pasó con cada canal (se guarda en `channels` y se muestra en Telegram y en el historial). */
export type ResultadoCorreo = "ENVIADO" | "FALLO" | "SIN_CORREO";
export type ResultadoWhatsapp = "ENVIADO" | "FALLO" | MotivoSinWhatsapp;
export type ResultadoCanales = { correo: ResultadoCorreo; whatsapp: ResultadoWhatsapp };

const MOTIVOS_WHATSAPP: Record<Exclude<ResultadoWhatsapp, "ENVIADO">, string> = {
  FALLO: "WhatsApp no salió (Meta lo rechazó)",
  SIN_CELULAR: "WhatsApp no: no dejó celular",
  SIN_CONEXION: "WhatsApp no: la conexión con Meta no está activa",
  VENTANA_CERRADA: "WhatsApp no: pasaron más de 24 h desde su último mensaje",
};

/** "Enviado por correo y WhatsApp." / "Enviado por correo. WhatsApp no: no dejó celular." */
export function textoDeCanales(r: ResultadoCanales): string {
  const salieron = [r.correo === "ENVIADO" ? "correo" : null, r.whatsapp === "ENVIADO" ? "WhatsApp" : null].filter(Boolean);
  const partes: string[] = [];
  partes.push(salieron.length > 0 ? `Enviado por ${salieron.join(" y ")}.` : "No salió por ningún canal.");
  if (r.correo === "FALLO") partes.push("El correo no salió: reenvialo desde el presupuesto.");
  if (r.correo === "SIN_CORREO") partes.push("No dejó correo.");
  if (r.whatsapp !== "ENVIADO") partes.push(`${MOTIVOS_WHATSAPP[r.whatsapp]}.`);
  return partes.join(" ");
}

/** ¿Le llegó algo al cliente? */
export function algunoSalio(r: ResultadoCanales): boolean {
  return r.correo === "ENVIADO" || r.whatsapp === "ENVIADO";
}

const nombrePila = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

/** El WhatsApp con el enlace a la página de su consulta. Sin cifras: el precio lo ve en la página. */
export function textoWhatsappDelPresupuesto(d: { nombre: string | null; categoria: string | null; enlace: string; estudio: string | null }): string {
  const hola = nombrePila(d.nombre) ? `¡Hola ${nombrePila(d.nombre)}!` : "¡Hola!";
  const para = d.categoria ? ` para ${d.categoria.toLowerCase()}` : "";
  const firma = d.estudio ? `\n\n${d.estudio}` : "";
  return `${hola} Ya está lista tu propuesta${para}. Acá podés ver fotos de otros trabajos, el detalle y el botón para reservar la fecha:\n${d.enlace}${firma}`;
}

export const ACUSE_POR_OMISION = "¡Gracias por escribirnos! Recibimos tu consulta y en un rato te mandamos la propuesta.";
export const MAX_ACUSE = 500;

/** El acuse configurado, o el de omisión si está vacío. */
export function textoDeAcuse(configurado: string | null | undefined): string {
  const t = (configurado ?? "").trim();
  return t ? t.slice(0, MAX_ACUSE) : ACUSE_POR_OMISION;
}
