import type { RenderedEmailSignature } from "@repo/communications/signature";

/**
 * Arma el cuerpo del email en HTML y texto plano.
 *
 * Función PURA y exportada a propósito: sin red ni variables de entorno, así se puede
 * verificar que la firma entra exactamente UNA vez en cada variante sin enviar nada.
 *
 * La firma se anexa DESPUÉS del cierre del template ("Gracias por elegirnos."), que sigue
 * siendo el único cierre: por eso el mapper deja `closingText` vacío y no se duplica.
 */
export function buildEnrollmentEmailBody(
  input: Omit<EnrollmentEmailInput, "signature">,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" });
  const classroomBlock =
    input.classroomLink || input.classroomCode || input.classroomInstructions
      ? `
<h3>Acceso al aula (Google Classroom)</h3>
${input.classroomLink ? `<p><strong>Link:</strong> <a href="${input.classroomLink}">${input.classroomLink}</a></p>` : ""}
${input.classroomCode ? `<p><strong>Código:</strong> ${input.classroomCode}</p>` : ""}
${input.classroomInstructions ? `<p><strong>Instrucciones:</strong><br/>${input.classroomInstructions.replace(/\n/g, "<br/>")}</p>` : ""}
`
      : "";

  const signatureHtml = signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${signature.html}</div>`
    : "";

  const html = `
<div>
  <p>Hola ${input.studentName},</p>
  <p>Tu pago fue aprobado y tu inscripción quedó confirmada.</p>
  <p><strong>Curso:</strong> ${input.courseTitle}</p>
  <p><strong>Edición:</strong> ${input.instanceLabel}</p>
  <p><strong>Inicio:</strong> ${dateFmt.format(input.startDateTime)}</p>
  <p><strong>Fin:</strong> ${dateFmt.format(input.endDateTime)}</p>
  <p><strong>Ubicación:</strong> ${input.locationName}${input.locationAddress ? ` - ${input.locationAddress}` : ""}</p>
  ${classroomBlock}
  <p>Gracias por elegirnos.</p>${signatureHtml}
</div>
`.trim();

  // El texto plano se arma aparte, no se deriva del HTML: así no arrastra marcado.
  const classroomText = [
    input.classroomLink ? `Link: ${input.classroomLink}` : null,
    input.classroomCode ? `Código: ${input.classroomCode}` : null,
    input.classroomInstructions ? `Instrucciones: ${input.classroomInstructions}` : null,
  ].filter(Boolean);

  const text = [
    `Hola ${input.studentName},`,
    "",
    "Tu pago fue aprobado y tu inscripción quedó confirmada.",
    "",
    `Curso: ${input.courseTitle}`,
    `Edición: ${input.instanceLabel}`,
    `Inicio: ${dateFmt.format(input.startDateTime)}`,
    `Fin: ${dateFmt.format(input.endDateTime)}`,
    `Ubicación: ${input.locationName}${input.locationAddress ? ` - ${input.locationAddress}` : ""}`,
    ...(classroomText.length ? ["", "Acceso al aula (Google Classroom)", ...classroomText] : []),
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

type EnrollmentEmailInput = {
  to: string;
  studentName: string;
  courseTitle: string;
  instanceLabel: string;
  startDateTime: Date;
  endDateTime: Date;
  locationName: string;
  locationAddress: string | null;
  classroomLink: string | null;
  classroomCode: string | null;
  classroomInstructions: string | null;
  /** Firma institucional ya renderizada. null = el email sale sin firma. */
  signature?: RenderedEmailSignature | null;
};

export async function sendEnrollmentApprovedEmail(input: EnrollmentEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FOTOFFICE_NOTIFICATIONS_FROM?.trim() || "Fotoffice <no-reply@fotoffice.app>";
  if (!resendApiKey) {
    return { sent: false, reason: "RESEND_API_KEY ausente" as const };
  }
  const signature = input.signature ?? null;
  const { html, text } = buildEnrollmentEmailBody(input, signature);
  const subject = `Inscripción confirmada: ${input.courseTitle}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
      text,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo enviar email de confirmación: ${text}`);
  }
  return { sent: true as const };
}
