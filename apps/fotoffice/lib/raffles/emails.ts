import { compose, type EmailBody } from "@/lib/membership/application-emails";
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
  partnerAddress?: string | null;
  partnerPhone?: string | null;
  partnerHours?: string | null;
  pickupDeadline: Date;
  institutionName: string;
  signature: RenderedEmailSignature | null;
};

/** Junta los datos del local en una sola línea, salteando lo que no esté cargado. */
function dondeRetirar(p: DatosPremio): string[] {
  const lineas = [`Lo retirás en ${p.partnerName}.`];
  if (p.partnerAddress) lineas.push(`Dirección: ${p.partnerAddress}`);
  if (p.partnerHours) lineas.push(`Horarios: ${p.partnerHours}`);
  if (p.partnerPhone) lineas.push(`Teléfono: ${p.partnerPhone}`);
  return lineas;
}

/**
 * El aviso al ganador.
 *
 * Lo primero que tiene que quedar claro es que ganó; lo segundo, hasta cuándo tiene. El plazo
 * va en el cuerpo y repetido al pie, porque es el dato por el que después se reclama.
 */
export function buildWinnerNoticeEmail(
  input: DatosPremio & { winnerFirstName: string },
): EmailBody {
  const vence = fechaLarga(input.pickupDeadline);

  const parrafos = [
    `Saliste sorteado en ${input.raffleTitle}: ganaste ${input.prizeTitle}, que dona ${input.partnerName}.`,
    ...dondeRetirar(input),
    `Tenés tiempo hasta el ${vence}. Si no vas antes de esa fecha, el premio se pierde.`,
    "Llevá tu carnet de socio: te lo van a pedir para entregártelo.",
  ];
  if (input.prizeConditions?.trim()) parrafos.push(input.prizeConditions.trim());

  return compose({
    subject: `Ganaste ${input.prizeTitle}`,
    greetingName: input.winnerFirstName,
    paragraphs: parrafos,
    notes: [`Retirá el premio antes del ${vence}.`],
    signature: input.signature,
  });
}

/**
 * El aviso al aliado que dona el premio.
 *
 * Cumple tres cosas a la vez: le dice a quién entregarle, hasta cuándo, y le pide el
 * comprobante que la institución necesita para justificar de dónde salió el premio. El pedido
 * es para **después** de la entrega, no antes: el remito documenta algo que ya pasó.
 */
export function buildSponsorNoticeEmail(
  input: DatosPremio & {
    winnerFullName: string;
    winnerMemberNumber: string;
    /** A dónde tiene que mandar el comprobante. Es el correo de la institución. */
    receiptEmail: string;
  },
): EmailBody {
  const vence = fechaLarga(input.pickupDeadline);

  return compose({
    subject: `Ya hay ganador para ${input.prizeTitle}`,
    greetingName: null,
    paragraphs: [
      `Se sorteó ${input.raffleTitle} y ${input.prizeTitle}, que ustedes donaron, le tocó a ${input.winnerFullName}, socio N° ${input.winnerMemberNumber} de ${input.institutionName}.`,
      `Va a pasar a retirarlo por ${input.partnerName} hasta el ${vence}. Pasada esa fecha el premio se pierde y no hay que entregarlo.`,
      "Le pedimos el carnet de socio al retirar, así confirman que es la persona correcta.",
      `Cuando el socio retire el premio, ¿nos mandan a ${input.receiptEmail} una foto o un PDF del remito? También sirve una factura por $0, con la leyenda «Sin valor comercial — Destinado a sorteo entre asociados».`,
      "Con eso ustedes justifican la salida de mercadería y nosotros dejamos constancia de cómo llegó el premio a la institución.",
    ],
    notes: [
      `Ganador: ${input.winnerFullName} (socio N° ${input.winnerMemberNumber}).`,
      `Retira hasta el ${vence}.`,
    ],
    signature: input.signature,
  });
}
