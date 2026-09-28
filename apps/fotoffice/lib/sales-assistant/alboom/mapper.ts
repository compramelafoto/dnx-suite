import type { Movimiento, OportunidadVenta } from "../opportunity";
import { ALBOOM_STATUS_ABIERTO, type AlboomActivity, type AlboomLeadRow, type AlboomMail } from "./types";

/**
 * JSON de Alboom → OportunidadVenta. Módulo PURO: se prueba con respuestas reales anonimizadas.
 *
 * Alboom guarda las fechas como texto en la hora de la cuenta (Argentina), sin zona. Leerlas
 * como UTC correría todo tres horas; un evento de las 00:00 caería el día anterior.
 */
export function fechaAlboom(s: string | null | undefined): Date | null {
  const m = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m || m[1] === "0000") return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function textoPlano(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const limpio = (s: string | null | undefined) => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

export function movimientosDesde(input: { activities: AlboomActivity[]; mails: AlboomMail[] }): Movimiento[] {
  const salida: Movimiento[] = [];
  for (const a of input.activities) {
    const fecha = fechaAlboom(a.created);
    if (!fecha) continue;
    salida.push({ fecha, tipo: a.text.startsWith("Etapa cambiada") ? "ETAPA" : "OTRO", texto: a.text });
  }
  for (const m of input.mails) {
    const fecha = fechaAlboom(m.created);
    if (!fecha) continue;
    const cuerpo = textoPlano(m.body ?? "").slice(0, 400);
    const texto = [limpio(m.subject), cuerpo].filter(Boolean).join(" — ");
    salida.push({ fecha, tipo: "CORREO", texto });
  }
  return salida.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

export function mapearOportunidad(row: AlboomLeadRow, movimientos: Movimiento[]): OportunidadVenta {
  const creadaEn = fechaAlboom(row.created) ?? new Date(0);
  return {
    fuente: "ALBOOM",
    idExterno: String(row.id),
    titulo: limpio(row.name) ?? "Sin título",
    tipoEvento: limpio(row.name),
    nombreCliente: limpio(row.customer_name) ?? "Sin nombre",
    apellidoCliente: limpio(row.customer_lastname),
    telefono: limpio(row.customer_cellular) ?? limpio(row.customer_phone),
    email: limpio(row.customer_email),
    fechaEvento: fechaAlboom(row.event_date),
    lugar: limpio(row.place_event),
    ciudad: limpio(row.city_event),
    invitados: limpio(row.guests),
    origen: limpio(row.lead_origin),
    descripcionCliente: limpio(row.description),
    embudo: limpio(row.pipeline_name) ?? "Sin embudo",
    etapa: limpio(row.stage_name) ?? "Sin etapa",
    etapaOrden: Number.parseInt(row.stage_id, 10) || 0,
    etapasTotal: Number.parseInt(row.stages_count ?? "", 10) || 0,
    abierta: String(row.status_id) === ALBOOM_STATUS_ABIERTO,
    creadaEn,
    presupuestoEnviadoEn: fechaAlboom(row.quote_sent_date),
    modificadaEn: fechaAlboom(row.modified) ?? creadaEn,
    movimientos,
  };
}
