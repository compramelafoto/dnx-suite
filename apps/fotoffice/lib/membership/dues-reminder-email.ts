import type { RenderedEmailSignature } from "@repo/communications/signature";
import { compose, escapeHtml, type EmailBody } from "./application-emails";
import { formatMinorArs } from "./money";

/**
 * El recordatorio de cuota.
 *
 * Función PURA, como el resto de los emails de socios: los importes, las fechas y el bloque
 * del sorteo se verifican sin enviar un solo correo.
 *
 * Lleva el sorteo adentro porque es el mejor motivo para pagar a tiempo: participa quien está
 * al día al cerrar el padrón, y el recordatorio sale justo antes de ese cierre. Contarlo en un
 * correo aparte sería mandarle dos mails a la misma persona en la misma semana.
 *
 * **No promete el premio.** Dice quiénes participan y cómo; ganar depende del azar.
 */

export type ReminderCharge = {
  /** «Cuota de octubre de 2026», «Carnet impreso»… ya listo para leer. */
  label: string;
  balanceMinor: number;
};

export type ReminderPrize = {
  title: string;
  description: string | null;
  partnerName: string | null;
  /** Dirección completa del logo. Sin ella el premio va sin imagen, nunca con una rota. */
  logoUrl: string | null;
};

export type ReminderRaffle = {
  title: string;
  /** «domingo 11 de octubre a las 20 h». */
  drawsAtLabel: string;
  /** «sábado 10 de octubre a las 20 h». */
  entriesCloseAtLabel: string;
  prizes: ReminderPrize[];
  url: string | null;
};

export function buildDuesReminderEmail(input: {
  firstName: string;
  institution: string;
  /** El cargo del mes en curso, si todavía lo debe. */
  current: (ReminderCharge & { dueDateLabel: string; monthLabel: string }) | null;
  /** Lo que ya venció antes y sigue impago. */
  overdue: ReminderCharge[];
  duesUrl: string | null;
  raffle: ReminderRaffle | null;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const totalMinor =
    (input.current?.balanceMinor ?? 0) + input.overdue.reduce((t, c) => t + c.balanceMinor, 0);

  const parrafos: string[] = [];
  if (input.current) {
    parrafos.push(
      `Te recordamos que tu cuota de ${input.current.monthLabel} en ${input.institution} vence el ${input.current.dueDateLabel}. El importe es ${formatMinorArs(input.current.balanceMinor)}.`,
    );
  }
  if (input.overdue.length > 0) {
    const detalle = input.overdue
      .map((c) => `${c.label} (${formatMinorArs(c.balanceMinor)})`)
      .join(", ");
    parrafos.push(
      input.current
        ? `Además tenés pendiente: ${detalle}. En total son ${formatMinorArs(totalMinor)}.`
        : `Te recordamos que en ${input.institution} tenés pendiente: ${detalle}. En total son ${formatMinorArs(totalMinor)}.`,
    );
  }
  parrafos.push(
    input.duesUrl
      ? "Podés pagar en línea desde «Mis cuotas», en tu cuenta de socio. Si ya pagaste, no hace falta que hagas nada: puede tardar un día en verse reflejado."
      : "Si ya pagaste, no hace falta que hagas nada: puede tardar un día en verse reflejado.",
  );

  const asunto = input.current
    ? `Tu cuota de ${input.current.monthLabel} vence el ${input.current.dueDateLabel}`
    : `Tenés cuotas pendientes en ${input.institution}`;

  return compose({
    subject: input.raffle ? `${asunto} · y este mes hay sorteo` : asunto,
    greetingName: input.firstName,
    paragraphs: parrafos,
    cta: input.duesUrl ? { label: "Pagar mi cuota", url: input.duesUrl } : null,
    blocks: input.raffle ? [raffleBlock(input.raffle)] : [],
    notes: [
      "Si todavía no activaste tu cuenta o tenés alguna duda, escribinos por los medios que figuran abajo.",
    ],
    signature: input.signature,
  });
}

/**
 * El bloque del sorteo.
 *
 * Tablas y estilos en línea a propósito: es lo único que Gmail y Outlook respetan igual. Un
 * `display:flex` se ve prolijo en el navegador y desarmado en la mitad de las casillas.
 */
function raffleBlock(raffle: ReminderRaffle): { html: string; text: string } {
  const explicacion = [
    `Participan todos los socios que el ${raffle.entriesCloseAtLabel} no tengan cuotas vencidas sin pagar. No hay que anotarse: si pagás antes de esa hora, ya estás adentro.`,
    "El ganador sale de un número al azar que se publica en internet después del cierre: nadie —tampoco la institución— puede conocerlo ni elegirlo antes, y cualquiera puede comprobar el resultado.",
  ];

  const filasPremios = raffle.prizes
    .map((p, i) => {
      const logo = p.logoUrl
        ? `<img src="${escapeHtml(p.logoUrl)}" alt="${escapeHtml(p.partnerName ?? "")}" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;">`
        : "";
      const dona = p.partnerName
        ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">Lo dona ${escapeHtml(p.partnerName)}</div>`
        : "";
      const detalle = p.description
        ? `<div style="font-size:13px;color:#374151;margin-top:4px;">${escapeHtml(p.description)}</div>`
        : "";
      return `<tr>
        <td width="112" valign="middle" style="padding:12px 16px 12px 0;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${logo}</td>
        <td valign="middle" style="padding:12px 0;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">
          <div style="font-weight:600;color:#111827;">${i + 1}. ${escapeHtml(p.title)}</div>${dona}${detalle}
        </td>
      </tr>`;
    })
    .join("\n");

  const enlace = raffle.url
    ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(raffle.url)}" style="color:#1d4ed8;font-weight:600;">Ver el sorteo y si estás participando →</a></p>`
    : "";

  const html = `<div style="margin:28px 0;padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${escapeHtml(raffle.title)}</p>
    <p style="margin:6px 0 12px;font-size:18px;font-weight:700;color:#111827;">Este mes sorteamos ${raffle.prizes.length === 1 ? "un premio" : `${raffle.prizes.length} premios`} entre los socios al día</p>
    <p style="margin:0 0 8px;color:#374151;">El sorteo es el <strong>${escapeHtml(raffle.drawsAtLabel)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
${filasPremios}
    </table>
    ${explicacion.map((e) => `<p style="margin:12px 0 0;font-size:14px;color:#374151;">${escapeHtml(e)}</p>`).join("\n    ")}
    ${enlace}
  </div>`;

  const text = [
    `${raffle.title.toUpperCase()}`,
    `Este mes sorteamos entre los socios al día. El sorteo es el ${raffle.drawsAtLabel}.`,
    "",
    ...raffle.prizes.map(
      (p, i) => `${i + 1}. ${p.title}${p.partnerName ? ` — lo dona ${p.partnerName}` : ""}`,
    ),
    "",
    ...explicacion,
    ...(raffle.url ? ["", `Ver el sorteo: ${raffle.url}`] : []),
  ].join("\n");

  return { html, text };
}

/**
 * «domingo 11 de octubre a las 20 h», en la hora de Rosario.
 *
 * El día de la semana va siempre: «el 11» obliga a buscar un calendario, «el domingo 11» no.
 */
export function fechaConDiaYHora(d: Date): string {
  const zona = "America/Argentina/Buenos_Aires";
  const dia = d.toLocaleDateString("es-AR", {
    timeZone: zona,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const minuto = partes.find((p) => p.type === "minute")?.value ?? "00";
  const horario = minuto === "00" ? `${hora} h` : `${hora}:${minuto} h`;
  return `${dia.replace(",", "")} a las ${horario}`;
}
