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
};

export async function sendEnrollmentApprovedEmail(input: EnrollmentEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FOTOFFICE_NOTIFICATIONS_FROM?.trim() || "Fotoffice <no-reply@fotoffice.app>";
  if (!resendApiKey) {
    return { sent: false, reason: "RESEND_API_KEY ausente" as const };
  }
  const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" });
  const subject = `Inscripción confirmada: ${input.courseTitle}`;
  const classroomBlock =
    input.classroomLink || input.classroomCode || input.classroomInstructions
      ? `
<h3>Acceso al aula (Google Classroom)</h3>
${input.classroomLink ? `<p><strong>Link:</strong> <a href="${input.classroomLink}">${input.classroomLink}</a></p>` : ""}
${input.classroomCode ? `<p><strong>Código:</strong> ${input.classroomCode}</p>` : ""}
${input.classroomInstructions ? `<p><strong>Instrucciones:</strong><br/>${input.classroomInstructions.replace(/\n/g, "<br/>")}</p>` : ""}
`
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
  <p>Gracias por elegirnos.</p>
</div>
`.trim();

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
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo enviar email de confirmación: ${text}`);
  }
  return { sent: true as const };
}
