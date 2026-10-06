import { compose, escapeHtml, type EmailBody } from "@/lib/membership/application-emails";
import type { RenderedEmailSignature } from "@repo/communications/signature";

/**
 * Los dos correos que salen cuando un sorteo se resuelve.
 *
 * Funciones PURAS: sin red, sin base y sin variables de entorno. Se puede verificar el
 * vocabulario, la fecha y el pedido del remito sin enviar un solo correo, que es la única
 * forma de probar textos que van a leer personas que no conocen el sistema.
 *
 * Usan el `compose` del circuito de asociación a propósito: los correos de la institución
 * tienen que verse todos iguales. Dos armados distintos terminan en dos estilos distintos
 * saliendo del mismo remitente.
 *
 * Reglas: le escribe una institución a una persona. Acá no existen «padrón», «tanda» ni
 * «award». El ganador lee que ganó algo y adónde ir a buscarlo.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/**
 * `2026-10-15` → `15 de octubre de 2026`, en hora argentina.
 *
 * Sin `Intl` con formato largo: el resultado no puede depender de la configuración regional
 * del servidor, que en Vercel es la que venga.
 */
export function fechaLarga(d: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(d);
  const p = Object.fromEntries(partes.map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return `${p.day} de ${MESES[p.month - 1]} de ${p.year}`;
}

type DatosPremio = {
  raffleTitle: string;
  prizeTitle: string;
  prizeConditions?: string | null;
  partnerName: string;
  partnerEmail?: string | null;
  partnerAddress?: string | null;
  partnerPhone?: string | null;
  partnerHours?: string | null;
  pickupDeadline: Date;
  institutionName: string;
  signature: RenderedEmailSignature | null;
};

/** Los datos de contacto del aliado, uno por renglón, salteando lo que no esté cargado. */
function contactoAliado(p: DatosPremio): string[] {
  const lineas: string[] = [];
  if (p.partnerEmail) lineas.push(`Correo: ${p.partnerEmail}`);
  if (p.partnerPhone) lineas.push(`Teléfono: ${p.partnerPhone}`);
  if (p.partnerAddress) lineas.push(`Dirección: ${p.partnerAddress}`);
  if (p.partnerHours) lineas.push(`Horarios: ${p.partnerHours}`);
  return lineas;
}

/**
 * El aviso al ganador.
 *
 * Lo primero que tiene que quedar claro es que ganó; lo segundo, con quién coordina la entrega
 * y hasta cuándo tiene. No se le dice «pasá por el local»: hay aliados que están en otra
 * ciudad, y cómo se entrega (en mano, por correo, en la institución) lo arreglan el ganador y
 * el aliado. Por eso van los datos de contacto del aliado, y al aliado le llegan los del
 * ganador. El plazo va en el cuerpo y repetido al pie, porque es el dato por el que después
 * se reclama.
 */
export function buildWinnerNoticeEmail(
  input: DatosPremio & { winnerFirstName: string },
): EmailBody {
  const vence = fechaLarga(input.pickupDeadline);
  const contacto = contactoAliado(input);

  const parrafos = [
    `Saliste sorteado en ${input.raffleTitle}: ganaste ${input.prizeTitle}, que dona ${input.partnerName}.`,
    `Para recibirlo, comunicate con ${input.partnerName} y coordiná con ellos la entrega. Ya les avisamos que ganaste y les pasamos tus datos de contacto.`,
    ...(contacto.length > 0 ? [`Datos de ${input.partnerName}:`, ...contacto] : []),
    `Tenés tiempo hasta el ${vence}. Si no lo coordinás antes de esa fecha, el premio se pierde.`,
    "Si hace falta enviártelo, el costo del envío lo pagás vos.",
    "Si lo retirás en persona, llevá tu carnet de socio: te lo van a pedir para entregártelo.",
  ];
  if (input.prizeConditions?.trim()) parrafos.push(input.prizeConditions.trim());

  return compose({
    subject: `Ganaste ${input.prizeTitle}`,
    greetingName: input.winnerFirstName,
    paragraphs: parrafos,
    notes: [`Coordiná la entrega con ${input.partnerName} antes del ${vence}.`],
    signature: input.signature,
  });
}

/**
 * El aviso al aliado que dona el premio. Sale siempre, se entregue como se entregue.
 *
 * Cumple tres cosas a la vez: le dice quién ganó y cómo contactarlo, hasta cuándo, y le pide
 * el comprobante que la institución necesita para justificar de dónde salió el premio. El
 * pedido es para **después** de la entrega, no antes: el remito documenta algo que ya pasó.
 */
export function buildSponsorNoticeEmail(
  input: DatosPremio & {
    winnerFullName: string;
    winnerMemberNumber: string;
    winnerEmail?: string | null;
    winnerPhone?: string | null;
    /** A dónde tiene que mandar el comprobante. Es el correo de la institución. */
    receiptEmail: string;
  },
): EmailBody {
  const vence = fechaLarga(input.pickupDeadline);
  const contactoGanador: string[] = [];
  if (input.winnerEmail) contactoGanador.push(`Correo: ${input.winnerEmail}`);
  if (input.winnerPhone) contactoGanador.push(`Teléfono: ${input.winnerPhone}`);

  return compose({
    subject: `Ya hay ganador para ${input.prizeTitle}`,
    greetingName: null,
    paragraphs: [
      `Se sorteó ${input.raffleTitle} y ${input.prizeTitle}, que ustedes donaron, le tocó a ${input.winnerFullName}, socio N° ${input.winnerMemberNumber} de ${input.institutionName}.`,
      `Le pedimos que se comunique con ustedes para coordinar la entrega.${
        contactoGanador.length > 0
          ? " Estos son sus datos, por si prefieren escribirle ustedes:"
          : ` No tenemos su correo ni su teléfono cargados: si no les escribe, avísennos a ${input.receiptEmail} y los ponemos en contacto.`
      }`,
      ...contactoGanador,
      `Tiene tiempo hasta el ${vence}. Pasada esa fecha el premio se pierde y no hay que entregarlo.`,
      "Si hace falta enviárselo, el costo del envío lo paga el ganador, no ustedes.",
      "Si lo retira en persona, pídanle el carnet de socio, así confirman que es la persona correcta.",
      `Cuando le entreguen el premio, ¿nos mandan a ${input.receiptEmail} una foto o un PDF del remito? También sirve una factura por $0, con la leyenda «Sin valor comercial — Destinado a sorteo entre asociados».`,
      "Con eso ustedes justifican la salida de mercadería y nosotros dejamos constancia de cómo llegó el premio a la institución.",
    ],
    notes: [
      `Ganador: ${input.winnerFullName} (socio N° ${input.winnerMemberNumber}).`,
      `Plazo para la entrega: hasta el ${vence}.`,
    ],
    signature: input.signature,
  });
}

/**
 * Los resultados, a todos los socios activos.
 *
 * Al que participó le cuenta quién ganó; al que no, además, que estando al día el mes que viene
 * entra. Los ganadores van con nombre e inicial, igual que en la página pública: es un correo
 * masivo y se reenvía.
 */
export function buildResultsEmail(input: {
  raffleTitle: string;
  winners: { prizeTitle: string; partnerName: string | null; winnerName: string }[];
  publicUrl: string | null;
  recipientFirstName: string;
  participated: boolean;
  memberWordPlural: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const lista = input.winners.map(
    (w) => `${w.prizeTitle}${w.partnerName ? ` (lo dona ${w.partnerName})` : ""}: ${w.winnerName}`,
  );
  const html = `<ul style="padding-left:20px;margin:8px 0 16px;">${input.winners
    .map(
      (w) =>
        `<li style="margin:6px 0;"><strong>${escapeHtml(w.prizeTitle)}</strong>${
          w.partnerName ? ` <span style="color:#6b7280;">(lo dona ${escapeHtml(w.partnerName)})</span>` : ""
        }<br>${escapeHtml(w.winnerName)}</li>`,
    )
    .join("")}</ul>`;

  const parrafos = [
    `Ya se hizo ${input.raffleTitle}. ${input.winners.length === 1 ? "Este es el ganador:" : "Estos son los ganadores:"}`,
  ];
  const cierre = input.participated
    ? "Gracias por estar al día: es lo que hace posible estos sorteos."
    : `Esta vez no participaste porque al cierre tenías cuotas pendientes. Participan todos los ${input.memberWordPlural} que están al día: ponete al día y entrás en el próximo.`;

  return compose({
    subject: `Resultados de ${input.raffleTitle}`,
    greetingName: input.recipientFirstName,
    paragraphs: parrafos,
    // Sin `cta`: `compose` pone el botón antes de los bloques, y acá tiene que ir después de
    // la lista de ganadores.
    blocks: [
      {
        html: `${html}\n  <p>${escapeHtml(cierre)}</p>${
          input.publicUrl
            ? `\n  <p style="margin:24px 0;"><a href="${escapeHtml(input.publicUrl)}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Ver el sorteo</a></p>`
            : ""
        }`,
        text: `${lista.join("\n")}\n\n${cierre}${input.publicUrl ? `\n\nVer el sorteo: ${input.publicUrl}` : ""}`,
      },
    ],
    notes: ["El resultado se puede comprobar: sale de un número público que no controla nadie de la institución."],
    signature: input.signature,
  });
}
