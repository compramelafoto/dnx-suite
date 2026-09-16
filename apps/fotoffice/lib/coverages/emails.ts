import { SINGLE_EMAIL_RE } from "@/lib/communications/constants";
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


/* ------------------------------------------------------------------------------------------
 * Los correos de armar el equipo (etapa 1b).
 *
 * Mismo armado que los de la solicitud: `compose` pone el saludo, el botón y la firma, y estas
 * funciones solo deciden QUÉ se dice. Los textos son de voluntariado —"te invitamos a
 * participar", "gracias por confirmar", "ya tenemos el equipo"— y van firmados por la
 * organización, no por FotoOffice: quien los recibe le presta su sábado a una institución con
 * nombre, no a un sistema.
 * ---------------------------------------------------------------------------------------- */

/**
 * Normaliza una lista de direcciones escritas a mano.
 *
 * Descarta las vacías, las que no parecen una dirección y las repetidas sin distinguir
 * mayúsculas. El filtro por `SINGLE_EMAIL_RE` no es cosmético: `Member.email` y los avisos de la
 * configuración son campos de texto libre donde alguien puede haber escrito "ana@x.com,
 * juan@y.com" en una sola línea, y mandar a esa cadena metería a dos personas en el mismo
 * correo — que es exactamente lo que este módulo no hace.
 */
function normalizarDestinatarios(valores: readonly (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const valor of valores) {
    const email = valor?.trim();
    if (!email || !SINGLE_EMAIL_RE.test(email)) continue;
    const clave = email.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(email);
  }
  return salida;
}

/**
 * A quiénes les llega el aviso de una convocatoria nueva.
 *
 * Devuelve una LISTA de direcciones, una por persona, y quien la use manda un correo por cada
 * una. **Nunca en copia.** No es una preferencia de estilo: la dirección de correo de un
 * voluntario es un dato personal suyo, y ponerla a la vista de los otros cuarenta colaboradores
 * de la institución la reparte sin que nadie se lo haya autorizado.
 */
export function destinatariosDeColaboradores(
  colaboradores: readonly { email: string | null }[],
): string[] {
  return normalizarDestinatarios(colaboradores.map((c) => c.email));
}

/**
 * A quién le llegan los avisos internos: los correos de la configuración del módulo y, si no hay
 * ninguno cargado, el de contacto de la institución.
 *
 * Mismo criterio que ya usa el aviso de solicitud nueva en `app/actions/coverage-request.ts`: sin
 * nadie configurado, el aviso no sale para nadie y quien llama lo registra, porque una
 * confirmación que nadie mira es peor que una que falló — nadie la va a reclamar.
 */
export function destinatariosDeCoordinacion(input: {
  notifyEmails: readonly string[];
  contactEmail: string | null;
}): string[] {
  const configurados = normalizarDestinatarios(input.notifyEmails);
  return configurados.length > 0 ? configurados : normalizarDestinatarios([input.contactEmail]);
}

/**
 * Se publicó una convocatoria: "hace falta gente para esto".
 *
 * Va a cada colaborador activo por separado (ver `destinatariosDeColaboradores`). No lleva
 * cuántos lugares quedan: entre que sale el correo y que la persona lo abre, ese número ya
 * cambió, y un aviso que miente sobre lo único concreto que dice deja de leerse.
 */
export function buildCallPublishedEmail(input: {
  context: WorkspaceEmailContext;
  /** Nombre de pila de quien recibe, si lo tenemos. */
  greetingName: string | null;
  callTitle: string;
  coverageTitle: string;
  fechaLabel: string;
  city: string | null;
  publicSummary: string | null;
  callUrl: string;
}): EmailBody {
  return compose({
    subject: `Buscamos gente para «${input.callTitle}» — ${input.context.organizationName}`,
    greetingName: input.greetingName,
    paragraphs: [
      `Se abrió una convocatoria para «${input.coverageTitle}».`,
      `Cuándo: ${input.fechaLabel}${input.city ? ` · Dónde: ${input.city}` : ""}`,
      ...(input.publicSummary ? [input.publicSummary] : []),
      "Si podés dar una mano, entrá y anotate al rol que te venga bien. Si esta vez no llegás, no pasa nada.",
    ],
    cta: { label: "Ver la convocatoria y anotarme", url: input.callUrl },
    notes: [
      `Recibís este correo porque figurás como colaborador activo de ${input.context.organizationName}.`,
    ],
    signature: input.context.signature,
  });
}

/**
 * Quedó seleccionada, o la invitamos directo: en los dos casos, lo que sigue es su respuesta.
 *
 * El enlace va directo a `/portal/coberturas/asignacion/{id}` a propósito: esta persona abre el
 * correo en el teléfono y tiene que poder contestar en dos toques, sin buscar nada.
 *
 * **Los datos reservados del día no viajan acá.** El teléfono de emergencia y el contacto del
 * lugar se ven en esa pantalla, con la sesión iniciada; un correo se reenvía, se queda en la
 * casilla de por vida y a veces lo lee alguien más.
 */
export function buildAssignmentInvitedEmail(input: {
  context: WorkspaceEmailContext;
  greetingName: string | null;
  coverageTitle: string;
  roleName: string;
  fechaLabel: string;
  city: string | null;
  assignmentUrl: string;
  /** Hasta cuándo esperamos la respuesta, ya formateado. `null` si no hay plazo. */
  respondByLabel: string | null;
}): EmailBody {
  return compose({
    subject: `Te invitamos a participar en «${input.coverageTitle}»`,
    greetingName: input.greetingName,
    paragraphs: [
      `Te queremos sumar al equipo de «${input.coverageTitle}» como ${input.roleName}.`,
      `Cuándo: ${input.fechaLabel}${input.city ? ` · Dónde: ${input.city}` : ""}`,
      "Entrá y contestanos si podés o no. Ahí vas a ver todos los detalles del día, incluidos los datos de contacto.",
      "Si no podés, avisanos igual: nos deja a tiempo de buscar a otra persona.",
    ],
    cta: { label: "Confirmar o avisar que no puedo", url: input.assignmentUrl },
    notes: input.respondByLabel
      ? [`Nos vendría bien tu respuesta antes del ${input.respondByLabel}.`]
      : [],
    signature: input.context.signature,
  });
}

/**
 * Alguien confirmó su lugar. Aviso interno, para la coordinación.
 *
 * Sin firma, como el de solicitud nueva: es una conversación entre quienes ya trabajan en la
 * institución, no una comunicación hacia afuera.
 *
 * El nombre de quien confirmó va en el cuerpo y no en el asunto: `SentEmailLog` guarda el asunto
 * y el destinatario de cada envío (no el cuerpo), y ese registro es para saber si un aviso salió,
 * no para dejar anotado quién participa de cada actividad.
 */
export function buildAssignmentConfirmedEmail(input: {
  coverageTitle: string;
  personName: string;
  roleName: string;
  fechaLabel: string;
  equipoCompleto: boolean;
  panelUrl: string;
}): EmailBody {
  return compose({
    subject: `Confirmaron un lugar en «${input.coverageTitle}»`,
    paragraphs: [
      `${input.personName} confirmó que va como ${input.roleName}.`,
      `${input.coverageTitle} — ${input.fechaLabel}`,
      input.equipoCompleto
        ? "Con esta confirmación el equipo quedó completo."
        : "Todavía faltan lugares por cubrir.",
    ],
    cta: { label: "Abrir en el panel", url: input.panelUrl },
    signature: null,
  });
}

/**
 * El equipo está armado: se lo contamos a la organización que pidió la cobertura.
 *
 * Sale cuando la cobertura llega a `EQUIPO_CONFIRMADO` —todas las asignaciones aceptadas—, no
 * cuando la convocatoria se pone `COMPLETA`. Es la diferencia entre "el equipo existe" y
 * "dejamos de buscar": avisar en el segundo momento sería prometer un equipo que todavía no
 * contestó.
 *
 * **No lleva los nombres de quienes van.** La organización se entera de que va a tener
 * cobertura; quiénes son las personas es asunto del día de la actividad y del panel de la 1c, no
 * de un correo que puede terminar reenviado a cualquier parte.
 */
export function buildTeamCompleteEmail(input: {
  context: WorkspaceEmailContext;
  publicCode: string;
  eventTitle: string;
  contactName: string;
  fechaLabel: string;
  city: string | null;
  trackingUrl: string;
}): EmailBody {
  return compose({
    subject: `Ya tenemos el equipo para tu pedido ${input.publicCode}`,
    greetingName: input.contactName,
    paragraphs: [
      `Buenas noticias: ya tenemos el equipo para «${input.eventTitle}».`,
      `Nos vemos el ${input.fechaLabel}${input.city ? `, en ${input.city}` : ""}.`,
      "Si algo cambia de acá al día de la actividad, te avisamos.",
    ],
    cta: { label: "Ver cómo va tu pedido", url: input.trackingUrl },
    notes: ["Guardá este correo: ese enlace es tuyo y no lo tiene nadie más."],
    signature: input.context.signature,
  });
}
