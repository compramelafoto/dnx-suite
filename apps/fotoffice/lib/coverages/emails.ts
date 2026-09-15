import type { WorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";

/**
 * Los correos del circuito de una solicitud.
 *
 * Armado puro: devuelven asunto, HTML y texto, y no envían nada. Enviar es de
 * `sendAndLogEmail`. Separarlo deja probar lo que importa —que el enlace esté, que el motivo
 * del rechazo se comunique, que no se filtre nada interno— sin un proveedor de correo.
 *
 * El armado del HTML, el texto plano y la firma copian exactamente el patrón de
 * `lib/membership/application-emails.ts`: misma estructura de párrafos, mismo botón de
 * llamada a la acción, misma firma al pie. Dos circuitos con formatos distintos harían pensar
 * a quien lee que le escriben dos instituciones distintas.
 *
 * Todos llevan versión de texto plano: hay gente que lee el correo en clientes que no pintan
 * HTML, y un mensaje vacío es peor que uno feo.
 */

export type EmailBody = { subject: string; html: string; text: string };

/**
 * A quién saludar en el correo.
 *
 * Preferimos el nombre de la persona de contacto sobre la razón social: es a ella a quien le
 * escribimos. Si no hay nombre cargado (una solicitud vieja, de antes de guardar
 * `firstName`/`lastName`), caemos a la razón social, y si tampoco hay nada, a "Equipo": nunca
 * "Hola", porque `compose` ya antepone un "Hola" al saludo y un cliente sin nombre ni razón
 * social terminaría recibiendo un correo que dice «Hola Hola,».
 */
export function contactGreetingName(client: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}): string {
  const nombre = [client.firstName, client.lastName].filter(Boolean).join(" ");
  return nombre || client.businessName || "Equipo";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Composition = {
  subject: string;
  /** Nombre de pila de quien recibe. Sin él el email arranca directo por el cuerpo. */
  greetingName?: string | null;
  paragraphs: string[];
  cta?: { label: string; url: string } | null;
  /** Aclaraciones al pie, en letra chica. */
  notes?: string[];
  signature: WorkspaceEmailContext["signature"];
};

/**
 * Arma el HTML y el texto plano de un email.
 *
 * Copia el armado de `compose` en `lib/membership/application-emails.ts` — mismo saludo,
 * mismo botón, misma firma, mismo pie — para que las dos casillas de un mismo remitente no
 * terminen escribiendo con dos estilos distintos.
 */
function compose(input: Composition): EmailBody {
  const saludo = input.greetingName?.trim() ? `Hola ${input.greetingName.trim()},` : null;

  const htmlParrafos = input.paragraphs.map((p) => `  <p>${escapeHtml(p)}</p>`).join("\n");

  // Sin URL no hay nada a dónde llevar: un botón que no lleva a ningún lado (y la línea de
  // "copiá y pegá" sin dirección debajo) es peor que no mostrar nada. Pasa cuando no se pudo
  // rotar el enlace por falta de `appUrl` (ver `debeRotarEnlace`); el resto del correo sale
  // igual.
  const cta = input.cta?.url.trim() ? input.cta : null;

  const htmlCta = cta
    ? `\n  <p style="margin:24px 0;">
    <a href="${escapeHtml(cta.url)}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">${escapeHtml(cta.label)}</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br>${escapeHtml(cta.url)}</p>`
    : "";

  const htmlNotas = (input.notes ?? [])
    .map((n) => `\n  <p style="font-size:13px;color:#6b7280;">${escapeHtml(n)}</p>`)
    .join("");

  const htmlFirma = input.signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${input.signature.html}</div>`
    : "";

  const html = `
<div>
${saludo ? `  <p>${escapeHtml(saludo)}</p>\n` : ""}${htmlParrafos}${htmlCta}${htmlNotas}${htmlFirma}
</div>
`.trim();

  const text = [
    ...(saludo ? [saludo, ""] : []),
    input.paragraphs.join("\n\n"),
    ...(cta ? ["", `${cta.label}:`, cta.url] : []),
    ...((input.notes ?? []).length ? ["", (input.notes ?? []).join("\n")] : []),
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");

  return { subject: input.subject, html, text };
}

type Base = {
  context: WorkspaceEmailContext;
  publicCode: string;
  eventTitle: string;
  contactName: string;
  trackingUrl: string;
};

/** Acuse de recibo. Sale apenas se envía el formulario, público o interno. */
export function buildRequestReceivedEmail(input: Base): EmailBody {
  return compose({
    subject: `Recibimos tu pedido ${input.publicCode} — ${input.context.organizationName}`,
    greetingName: input.contactName,
    paragraphs: [
      `Recibimos el pedido de cobertura para «${input.eventTitle}». Tu número es ${input.publicCode}.`,
      "Lo vamos a revisar y te escribimos con una respuesta, sea cual sea. No hace falta que hagas nada más por ahora.",
    ],
    cta: { label: "Ver cómo va tu pedido", url: input.trackingUrl },
    notes: ["Guardá este correo: ese enlace es tuyo y no lo tiene nadie más."],
    signature: input.context.signature,
  });
}

/**
 * Pide la información que falta.
 *
 * `infoRequested` se transcribe tal como lo escribió quien coordina: es una pregunta dirigida
 * a esta organización puntual, no una plantilla genérica.
 */
export function buildInfoRequestedEmail(input: Base & { infoRequested: string }): EmailBody {
  return compose({
    subject: `Nos falta un dato — ${input.publicCode}`,
    greetingName: input.contactName,
    paragraphs: [
      `Para seguir con «${input.eventTitle}» necesitamos que nos cuentes esto:`,
      input.infoRequested,
    ],
    cta: { label: "Responder desde acá", url: input.trackingUrl },
    signature: input.context.signature,
  });
}

/** Aprobación. Deja claro que tomar el pedido no es lo mismo que tener el equipo armado. */
export function buildRequestApprovedEmail(input: Base): EmailBody {
  return compose({
    subject: `Tomamos tu pedido ${input.publicCode}`,
    greetingName: input.contactName,
    paragraphs: [
      `Buenas noticias: tomamos el pedido para «${input.eventTitle}».`,
      "Ahora empezamos a armar el equipo. Te vamos a avisar en cuanto esté confirmado quién va a estar ese día.",
    ],
    cta: { label: "Ver cómo va tu pedido", url: input.trackingUrl },
    signature: input.context.signature,
  });
}

/**
 * Rechazo.
 *
 * NO lleva enlace de seguimiento: el circuito terminó, y un enlace que lleva a una pantalla
 * sin nada que hacer solo invita a volver a mirar un "no". El motivo se transcribe tal como lo
 * escribió la coordinación.
 */
export function buildRequestRejectedEmail(input: Base & { reason: string }): EmailBody {
  return compose({
    subject: `Sobre tu pedido ${input.publicCode}`,
    greetingName: input.contactName,
    paragraphs: [
      `Esta vez no vamos a poder cubrir «${input.eventTitle}».`,
      input.reason,
      "Gracias por haber pensado en nosotros. Si surge otra actividad, escribinos de nuevo.",
    ],
    signature: input.context.signature,
  });
}

/**
 * El aviso interno de que entró una solicitud.
 *
 * Sin datos de contacto de la organización: el que lo reciba entra al panel y los ve ahí, con
 * el permiso que corresponda. Tampoco lleva firma: es un aviso interno entre quienes ya
 * trabajan en la institución, no una comunicación hacia afuera.
 */
export function buildCoordinatorAlertEmail(input: {
  publicCode: string;
  eventTitle: string;
  orgName: string;
  startsAtLabel: string;
  panelUrl: string;
}): EmailBody {
  return compose({
    // La institución va adelante: una misma casilla puede atender a más de una.
    subject: `Nueva solicitud ${input.publicCode} — ${input.orgName}`,
    paragraphs: [
      "Entró una solicitud nueva.",
      `${input.publicCode} — ${input.eventTitle}`,
      `Organización: ${input.orgName}`,
      `Fecha: ${input.startsAtLabel}`,
    ],
    cta: { label: "Abrir en el panel", url: input.panelUrl },
    signature: null,
  });
}
