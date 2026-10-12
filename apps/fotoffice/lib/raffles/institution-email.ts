import { compose, escapeHtml, type EmailBody } from "@/lib/membership/application-emails";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { fechaLarga } from "./emails";

/**
 * El resumen del sorteo para la propia institución: quién ganó, cómo ubicarlo y qué avisos
 * salieron.
 *
 * Función PURA, como los otros correos del sorteo. A diferencia del correo de resultados a los
 * socios, este lleva el nombre completo y los datos de contacto de cada ganador: lo lee la
 * Secretaría, que es la que tiene que llamar si un aviso no salió.
 *
 * Por eso cada premio dice si al ganador y al aliado ya se les avisó. Sin eso, la Secretaría
 * no sabe si tiene que hacer algo, y el único que lo sabía era el panel.
 */

export type InstitutionSummaryPrize = {
  prizeTitle: string;
  partnerName: string | null;
  winnerFullName: string;
  winnerMemberNumber: string;
  winnerEmail: string | null;
  winnerPhone: string | null;
  winnerNotified: boolean;
  winnerNoticeError: string | null;
  sponsorNotified: boolean;
  sponsorNoticeError: string | null;
};

export function buildInstitutionSummaryEmail(input: {
  raffleTitle: string;
  drawsAt: Date;
  entrantsCount: number;
  pickupDeadline: Date | null;
  /** "socio", o la palabra que use la institución. */
  memberWord: string;
  memberWordPlural: string;
  adminUrl: string | null;
  prizes: InstitutionSummaryPrize[];
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const premios = input.prizes.map((p) => {
    const titulo = `${p.prizeTitle}${p.partnerName ? ` (lo dona ${p.partnerName})` : ""}`;
    const ganador = `${p.winnerFullName}, ${input.memberWord} N° ${p.winnerMemberNumber}`;
    const contacto = [p.winnerEmail, p.winnerPhone].filter(Boolean).join(" · ") || "Sin correo ni teléfono cargados.";
    const aliado = p.partnerName ?? "el aliado";
    const avisos: { texto: string; problema: boolean }[] = [];
    if (p.winnerNotified && p.sponsorNotified) {
      avisos.push({ texto: `Ya le avisamos por correo al ganador y a ${aliado}.`, problema: false });
    } else {
      avisos.push(
        p.winnerNotified
          ? { texto: "Ya le avisamos por correo al ganador.", problema: false }
          : {
              texto: `No le pudimos avisar al ganador${p.winnerNoticeError ? `: ${p.winnerNoticeError}` : "."}`,
              problema: true,
            },
        p.sponsorNotified
          ? { texto: `Ya le avisamos por correo a ${aliado}.`, problema: false }
          : {
              texto: `No le pudimos avisar a ${aliado}${p.sponsorNoticeError ? `: ${p.sponsorNoticeError}` : "."}`,
              problema: true,
            },
      );
    }
    return { titulo, ganador, contacto, avisos };
  });

  const html = `<ul style="padding-left:20px;margin:8px 0 16px;">${premios
    .map(
      (p) =>
        `<li style="margin:10px 0;"><strong>${escapeHtml(p.titulo)}</strong><br>${escapeHtml(p.ganador)}<br><span style="color:#6b7280;">${escapeHtml(p.contacto)}</span>${p.avisos
          .map(
            (a) =>
              `<br><span style="color:${a.problema ? "#b91c1c" : "#15803d"};">${escapeHtml(a.texto)}</span>`,
          )
          .join("")}</li>`,
    )
    .join("")}</ul>`;
  const texto = premios
    .map((p) => [`• ${p.titulo}`, `  ${p.ganador}`, `  ${p.contacto}`, ...p.avisos.map((a) => `  ${a.texto}`)].join("\n"))
    .join("\n\n");

  const parrafos = [
    `Se hizo ${input.raffleTitle} el ${fechaLarga(input.drawsAt)}, entre ${input.entrantsCount} ${input.entrantsCount === 1 ? input.memberWord : input.memberWordPlural} al día. ${input.prizes.length === 1 ? "Este es el ganador:" : "Estos son los ganadores:"}`,
  ];
  const cierre = [
    input.pickupDeadline
      ? `Tienen tiempo de retirar los premios hasta el ${fechaLarga(input.pickupDeadline)}.`
      : null,
    "Cuando un aliado entregue un premio, va a mandar a este correo el remito o la factura por $0. Con eso, marquen el premio como retirado en Sorteos → Entregas.",
  ]
    .filter((x): x is string => x !== null)
    .join(" ");

  return compose({
    subject: `Ganadores de ${input.raffleTitle}`,
    greetingName: null,
    paragraphs: parrafos,
    // Sin `cta`: `compose` pone el botón antes de los bloques, y acá va después de la lista.
    blocks: [
      {
        html: `${html}\n  <p>${escapeHtml(cierre)}</p>${
          input.adminUrl
            ? `\n  <p style="margin:24px 0;"><a href="${escapeHtml(input.adminUrl)}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Ver el sorteo en FotOffice</a></p>`
            : ""
        }`,
        text: `${texto}\n\n${cierre}${input.adminUrl ? `\n\nVer el sorteo en FotOffice: ${input.adminUrl}` : ""}`,
      },
    ],
    notes: ["Este correo es para la institución: trae datos de contacto de los socios, no lo reenvíen."],
    signature: input.signature,
  });
}
