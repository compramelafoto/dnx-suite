import "server-only";
import { prisma } from "@repo/db";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { ETIQUETA_MODALIDAD, type AjustesTurnos, type Modalidad } from "./constantes";
import { fechaLarga } from "./disponibilidad";
import { armarIcs } from "./ics";
import { limiteParaGestionar } from "./plazo";

/**
 * Correos de los turnos: al cliente (confirmado, reprogramado, cancelado) y al estudio (aviso de cada
 * movimiento). Nunca lanzan: el turno ya quedó guardado. Sin direcciones ni datos en los registros.
 */

export type DatosCorreoTurno = {
  workspaceId: string;
  turnoId: string;
  tipoNombre: string;
  modalidad: Modalidad;
  lugar: string | null;
  inicio: Date;
  fin: Date;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  mensaje: string | null;
  /** Enlace de gestión completo (sólo en el correo al cliente). */
  enlaceGestion: string | null;
};

export type EventoTurno = "CONFIRMADO" | "REPROGRAMADO" | "CANCELADO";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Origen público de la aplicación ("https://fotoffice.com"), sin barra final. */
export function origenPublico(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://fotoffice.com").replace(/\/+$/, "");
}

export function enlaceDeGestion(slug: string, token: string): string {
  return `${origenPublico()}/w/${encodeURIComponent(slug)}/turnos/gestion/${token}`;
}

function cajaHtml(filas: [string, string][]): string {
  return `<table style="border-collapse:collapse;margin:16px 0">${filas
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>`;
}

function marco(cuerpo: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:560px">${cuerpo}</div>`;
}

export function correoAlCliente(d: DatosCorreoTurno, evento: EventoTurno, negocio: string, ajustes: Pick<AjustesTurnos, "cancelWindowHours">) {
  const cuando = fechaLarga(d.inicio);
  const filas: [string, string][] = [["Turno", d.tipoNombre], ["Cuándo", cuando], ["Modalidad", ETIQUETA_MODALIDAD[d.modalidad]]];
  if (d.lugar) filas.push([d.modalidad === "ONLINE" ? "Enlace" : "Dónde", d.lugar]);
  const asunto =
    evento === "CANCELADO" ? `Turno cancelado: ${d.tipoNombre}` : evento === "REPROGRAMADO" ? `Turno reprogramado: ${d.tipoNombre}, ${cuando}` : `Turno confirmado: ${d.tipoNombre}, ${cuando}`;
  const intro =
    evento === "CANCELADO"
      ? `Hola ${d.contactName}, cancelamos tu turno con ${negocio}. Si querés, podés reservar otro cuando quieras.`
      : evento === "REPROGRAMADO"
        ? `Hola ${d.contactName}, tu turno con ${negocio} quedó en el nuevo horario.`
        : `Hola ${d.contactName}, tu turno con ${negocio} está confirmado.`;
  const limite = fechaLarga(limiteParaGestionar(d.inicio, ajustes.cancelWindowHours));
  const gestion =
    evento !== "CANCELADO" && d.enlaceGestion
      ? `<p>Si necesitás cambiar el horario o cancelarlo, podés hacerlo hasta el ${esc(limite)} desde este enlace:</p>
<p><a href="${esc(d.enlaceGestion)}" style="display:inline-block;background:#111827;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Ver o cambiar mi turno</a></p>
<p style="color:#6b7280;font-size:13px">Te adjuntamos el archivo para agregarlo a tu calendario.</p>`
      : "";
  const html = marco(`<p>${esc(intro)}</p>${evento === "CANCELADO" ? "" : cajaHtml(filas)}${gestion}<p>${esc(negocio)}</p>`);
  const text = [
    intro,
    "",
    ...(evento === "CANCELADO" ? [] : filas.map(([k, v]) => `${k}: ${v}`)),
    ...(evento !== "CANCELADO" && d.enlaceGestion ? ["", `Para cambiarlo o cancelarlo (hasta el ${limite}): ${d.enlaceGestion}`] : []),
    "",
    negocio,
  ].join("\n");
  return { asunto, html, text };
}

export function correoAlEstudio(d: DatosCorreoTurno, evento: EventoTurno) {
  const cuando = fechaLarga(d.inicio);
  const verbo = evento === "CANCELADO" ? "canceló" : evento === "REPROGRAMADO" ? "reprogramó" : "reservó";
  const asunto = `${d.contactName} ${verbo} un turno: ${d.tipoNombre}, ${cuando}`;
  const filas: [string, string][] = [
    ["Turno", d.tipoNombre],
    ["Cuándo", cuando],
    ["Cliente", d.contactName],
    ["Correo", d.contactEmail],
    ...(d.contactPhone ? ([["Teléfono", d.contactPhone]] as [string, string][]) : []),
  ];
  const html = marco(
    `<p>${esc(d.contactName)} ${verbo} un turno desde tu sitio.</p>${cajaHtml(filas)}${d.mensaje ? `<p><strong>Mensaje:</strong><br>${esc(d.mensaje).replace(/\n/g, "<br>")}</p>` : ""}<p style="color:#6b7280;font-size:13px">Ya está en tu Agenda de FOTOFFICE.</p>`,
  );
  const text = [`${d.contactName} ${verbo} un turno desde tu sitio.`, "", ...filas.map(([k, v]) => `${k}: ${v}`), ...(d.mensaje ? ["", "Mensaje:", d.mensaje] : [])].join("\n");
  return { asunto, html, text };
}

async function correoDelEstudio(workspaceId: string, ajustes: AjustesTurnos, hostUserId: number | null): Promise<string | null> {
  if (ajustes.notifyEmail) return ajustes.notifyEmail;
  if (hostUserId === null) return null;
  const u = await prisma.user.findUnique({ where: { id: hostUserId }, select: { email: true } });
  return (u?.email as string | undefined) ?? null;
}

export async function avisarTurno(d: DatosCorreoTurno, evento: EventoTurno, ajustes: AjustesTurnos, hostUserId: number | null, ahora: Date): Promise<void> {
  try {
    const sender = await loadWorkspaceSender(d.workspaceId);
    const negocio = sender.name ?? "el estudio";
    const ics = armarIcs({
      uid: `turno-${d.turnoId}@fotoffice.com`,
      inicio: d.inicio,
      fin: d.fin,
      titulo: `${d.tipoNombre} — ${negocio}`,
      descripcion: d.enlaceGestion ? `Para cambiarlo o cancelarlo: ${d.enlaceGestion}` : null,
      lugar: d.lugar,
      ahora,
      metodo: evento === "CANCELADO" ? "CANCEL" : "PUBLISH",
      secuencia: Math.floor(ahora.getTime() / 1000),
    });
    const adjunto = [{ filename: "turno.ics", content: new TextEncoder().encode(ics), contentType: "text/calendar" }];

    const c = correoAlCliente(d, evento, negocio, ajustes);
    const r1 = await sendTransactionalEmail({ to: d.contactEmail, subject: c.asunto, html: c.html, text: c.text, sender, ...(evento === "CANCELADO" ? {} : { attachments: adjunto }) });
    if (r1.status !== "SENT") console.error("[turnos] correo al cliente no salió", { estado: r1.status });

    const destino = await correoDelEstudio(d.workspaceId, ajustes, hostUserId);
    if (destino) {
      const e = correoAlEstudio(d, evento);
      const r2 = await sendTransactionalEmail({ to: destino, subject: e.asunto, html: e.html, text: e.text, replyTo: d.contactEmail, ...(evento === "CANCELADO" ? {} : { attachments: adjunto }) });
      if (r2.status !== "SENT") console.error("[turnos] aviso al estudio no salió", { estado: r2.status });
    }
  } catch (error) {
    console.error("[turnos] avisarTurno falló", { error: (error as { name?: string } | null)?.name ?? "desconocido" });
  }
}
