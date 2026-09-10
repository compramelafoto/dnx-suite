import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";

/**
 * El texto del evento que va a Google Calendar.
 *
 * Se escribe para que quien mira el calendario —la Secretaría, la Comisión— no tenga que
 * abrir FotoOffice para saber quién reservó ni cómo ubicarlo. Por eso el número de socio y
 * el teléfono van en el cuerpo y no en un enlace a "ver más".
 *
 * Módulo PURO: recibe los datos ya leídos y devuelve strings. Sin base y sin red.
 */

export type CalendarEventExtra = {
  name: string;
  units: number;
  amountArs: string;
  /** PENDING_CONFIRMATION | CONFIRMED | REMOVED */
  status: string;
};

export type CalendarEventData = {
  spaceName: string;
  contactName: string;
  contactEmail: string;
  /** El que dejó al reservar. Tiene prioridad: es el más reciente. */
  contactPhone: string | null;
  /** El del padrón, como respaldo cuando la reserva no dejó teléfono. */
  memberPhone: string | null;
  memberNumber: string | null;
  extras: readonly CalendarEventExtra[];
};

/** Un extra quitado no se contrató: no tiene por qué figurar. */
const VISIBLES = new Set(["CONFIRMED", "PENDING_CONFIRMATION"]);

/**
 * El título: espacio, quién, y el número de socio cuando corresponde.
 *
 * Va tan corto porque en la grilla de Google se ve recortado. Lo que no entra ahí se lee
 * en la descripción, no se pierde.
 */
export function buildEventSummary(data: CalendarEventData): string {
  const socio = data.memberNumber ? ` · N° ${data.memberNumber}` : "";
  return `${data.spaceName} — ${data.contactName}${socio}`;
}

function formatearImporte(amountArs: string): string {
  const numero = Number(amountArs);
  if (!Number.isFinite(numero)) return amountArs;
  return `$${numero.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

/**
 * El teléfono, con enlace solo si sirve.
 *
 * `normalizeWhatsappNumber` exige código de país a propósito y devuelve `null` cuando no
 * lo tiene. En ese caso se muestra el número tal como está cargado: un número incompleto
 * a la vista se puede completar a ojo, pero un `wa.me` armado adivinando el país abre el
 * chat de un desconocido.
 */
function lineasDeTelefono(data: CalendarEventData): string[] {
  const crudo = data.contactPhone?.trim() || data.memberPhone?.trim() || null;
  if (!crudo) return [];

  const normalizado = normalizeWhatsappNumber(crudo);
  return normalizado
    ? [`WhatsApp: ${crudo}`, `https://wa.me/${normalizado}`]
    : [`Teléfono: ${crudo}`];
}

export function buildEventDescription(data: CalendarEventData): string {
  const quien = data.memberNumber
    ? `Socio N° ${data.memberNumber} · ${data.contactName}`
    : `No socio · ${data.contactName}`;

  const lineas: string[] = [quien, ...lineasDeTelefono(data)];
  if (data.contactEmail.trim()) lineas.push(`Email: ${data.contactEmail.trim()}`);

  const extras = data.extras.filter((e) => VISIBLES.has(e.status));
  if (extras.length > 0) {
    lineas.push("", "Extras");
    for (const e of extras) {
      const unidades = e.units > 1 ? ` ×${e.units}` : "";
      const pendiente = e.status === "PENDING_CONFIRMATION" ? " (a confirmar)" : "";
      lineas.push(`· ${e.name}${unidades} — ${formatearImporte(e.amountArs)}${pendiente}`);
    }
  }

  lineas.push("", "Reserva de FotoOffice. No edites este evento acá: se maneja desde FotoOffice.");
  return lineas.join("\n");
}
