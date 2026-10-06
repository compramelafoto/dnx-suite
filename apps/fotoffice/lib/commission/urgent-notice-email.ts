import type { RenderedEmailSignature } from "@repo/communications/signature";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { formatMinorArs } from "@/lib/membership/money";
import { INVITATION_TTL_LABEL } from "@/lib/members/invitations";

/**
 * Aviso urgente a integrantes de la Comisión Directiva que todavía no pueden gestionarla:
 * porque no activaron su cuenta o porque tienen cuotas pendientes.
 *
 * Funciones PURAS (sin red ni base). Los lee gente que no es técnica: nada de vocabulario
 * interno, y sin género (se habla de la cuenta y de la situación, no de "activo" o "activa").
 */

/** Rojo de alerta. No está en la paleta general porque ningún otro correo grita. */
const URGENTE = { fondo: "#fef2f2", borde: "#dc2626", texto: "#b91c1c" } as const;

export type PendingDebt = { count: number; totalMinor: number };

type Common = {
  memberFirstName: string;
  institution: string;
  officeName: string | null;
  roleNames: string[];
  signature: RenderedEmailSignature | null;
};

/** "$ 12.000" (sin ",00" cuando es un importe redondo, que es el caso de casi toda cuota). */
export function formatPesos(minor: number): string {
  return formatMinorArs(minor).replace(/,00$/, "");
}

export function cuotasPendientesText(count: number, totalMinor: number): string {
  const cuotas = count === 1 ? "1 cuota pendiente" : `${count} cuotas pendientes`;
  return `Tenés ${cuotas} por ${formatPesos(totalMinor)}.`;
}

export function cargoLine(officeName: string | null, roleNames: string[]): string {
  const como = officeName ? ` como ${officeName}` : "";
  const roles =
    roleNames.length === 0 ? "" : ` (${roleNames.length === 1 ? "rol" : "roles"}: ${roleNames.join(", ")})`;
  return `Integrás la Comisión Directiva${como}${roles}.`;
}

type Paragraph = { text: string; strong?: boolean };

function layout(input: {
  institution: string;
  greeting: string;
  paragraphs: Paragraph[];
  cta: { label: string; url: string };
  ctaNote: string | null;
  signature: RenderedEmailSignature | null;
}): string {
  const ps = input.paragraphs
    .map(
      (p) =>
        `<p class="cuerpo" style="margin:0 0 14px;font-size:15px;line-height:1.62;color:${C.cuerpo};">${
          p.strong ? `<strong>${escapeHtml(p.text)}</strong>` : escapeHtml(p.text)
        }</p>`,
    )
    .join("\n    ");
  const url = escapeHtml(input.cta.url);
  const nota = input.ctaNote ? `${escapeHtml(input.ctaNote)} ` : "";
  const firma = input.signature
    ? `
  <tr><td style="padding:0 30px;"><div class="regla" style="height:1px;background:${C.borde};"></div></td></tr>
  <tr><td class="pie" id="fo-signature" style="padding:18px 30px 22px;">${input.signature.html}</td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  @media (prefers-color-scheme:dark){
    .lienzo{background:#0b1220!important}
    .tarjeta{background:#111c2e!important;border-color:#24344d!important}
    .tinta{color:#e8eef7!important}
    .cuerpo{color:#c3cede!important}
    .apagado{color:#8b9bb4!important}
    .urgente{background:#3b0d0d!important;color:#fca5a5!important}
    .regla{background:#24344d!important}
    .pie a{color:#8b9bb4!important}
  }
</style></head>
<body class="lienzo" style="margin:0;padding:0;background:${C.lienzo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lienzo" style="background:${C.lienzo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tarjeta"
  style="width:100%;max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;overflow:hidden;font-family:${FUENTE};">
  <tr><td class="urgente" style="padding:14px 30px;background:${URGENTE.fondo};border-bottom:3px solid ${URGENTE.borde};font-size:12px;font-weight:700;letter-spacing:1.6px;color:${URGENTE.texto};">URGENTE · ${escapeHtml(input.institution)}</td></tr>
  <tr><td style="padding:26px 30px 8px;">
    <p class="tinta" style="margin:0 0 14px;font-size:20px;font-weight:600;color:${C.tinta};">${escapeHtml(input.greeting)}</p>
    ${ps}
  </td></tr>
  <tr><td style="padding:8px 30px 24px;">
    <a href="${url}" style="display:inline-block;background:${URGENTE.borde};color:#ffffff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
    <p class="apagado" style="margin:12px 0 0;font-size:12px;color:${C.tenue};">${nota}Si el botón no funciona, copiá esta dirección:<br>${url}</p>
  </td></tr>${firma}
</table>
</td></tr></table></body></html>`;
}

function plain(input: {
  greeting: string;
  paragraphs: Paragraph[];
  cta: { label: string; url: string };
  ctaNote: string | null;
  signature: RenderedEmailSignature | null;
}): string {
  return [
    input.greeting,
    "",
    ...input.paragraphs.flatMap((p) => [p.text, ""]),
    `${input.cta.label}:`,
    input.cta.url,
    ...(input.ctaNote ? ["", input.ctaNote] : []),
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");
}

/** (A) Sin cuenta: la invitación de siempre, con el texto urgente. Si además debe, lo dice. */
export function buildUrgentActivationEmail(
  input: Common & { invitationUrl: string; debt: PendingDebt | null },
): { subject: string; html: string; text: string } {
  const subject = `URGENTE: activá tu cuenta para gestionar la Comisión Directiva de ${input.institution}`;
  const greeting = `Hola ${input.memberFirstName},`;
  const paragraphs: Paragraph[] = [
    { text: cargoLine(input.officeName, input.roleNames) },
    {
      text: "Es urgente que actives tu cuenta: sin ella no figurás en actividad en el sistema y no podés gestionar la Comisión Directiva.",
      strong: true,
    },
  ];
  if (input.debt && input.debt.count > 0) {
    const plural = input.debt.count === 1 ? "regularizala" : "regularizalas";
    paragraphs.push({
      text: `${cuotasPendientesText(input.debt.count, input.debt.totalMinor)} Cuando entres, ${plural} desde la sección Cuotas para poder seguir gestionando la Comisión Directiva.`,
    });
  }
  const cta = { label: "Activar mi cuenta", url: input.invitationUrl };
  const ctaNote = `El enlace vence en ${INVITATION_TTL_LABEL}.`;
  return {
    subject,
    html: layout({ institution: input.institution, greeting, paragraphs, cta, ctaNote, signature: input.signature }),
    text: plain({ greeting, paragraphs, cta, ctaNote, signature: input.signature }),
  };
}

/** (B) Con cuenta y con cuotas pendientes. */
export function buildUrgentDebtEmail(
  input: Common & { duesUrl: string; debt: PendingDebt },
): { subject: string; html: string; text: string } {
  const subject = `URGENTE: regularizá tu situación para gestionar la Comisión Directiva de ${input.institution}`;
  const greeting = `Hola ${input.memberFirstName},`;
  const paragraphs: Paragraph[] = [
    { text: cargoLine(input.officeName, input.roleNames) },
    { text: cuotasPendientesText(input.debt.count, input.debt.totalMinor) },
    {
      text: "Es urgente que regularices tu situación para seguir en actividad en el sistema y poder gestionar la Comisión Directiva.",
      strong: true,
    },
  ];
  const cta = { label: "Pagar mis cuotas", url: input.duesUrl };
  const ctaNote = "Si ya pagaste en los últimos días, ignorá este mensaje.";
  return {
    subject,
    html: layout({ institution: input.institution, greeting, paragraphs, cta, ctaNote, signature: input.signature }),
    text: plain({ greeting, paragraphs, cta, ctaNote, signature: input.signature }),
  };
}
