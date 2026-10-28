/**
 * La ficha de arriba del enlace público: para quién es, qué evento, cuándo y dónde. Módulo PURO:
 * recibe lo leído de la base (cliente, consulta) y devuelve sólo texto para mostrar. Nunca el
 * teléfono, el correo, el documento ni notas internas: sólo lo que el cliente ya nos contó de su
 * evento y su nombre.
 */

export type FichaDeLaVista = {
  /** Nombre completo (o razón social), para «Preparado para». */
  cliente: string | null;
  /** Para saludar: «Daniel, elegí tu propuesta». */
  nombrePila: string | null;
  /** El tipo de evento (la categoría de la consulta): «Boda», «Cumpleaños de 15». */
  evento: string | null;
  /** «lunes 16 de noviembre de 2026». */
  fecha: string | null;
  /** «21:00», sólo si se conoce la hora. */
  hora: string | null;
  /** «Faltan 19 días», «Faltan 4 meses»; null si ya pasó o no hay fecha. */
  faltan: string | null;
  /** Ceremonia, fiesta o lugar, en ese orden y sin repetir. */
  lugares: { etiqueta: string; valor: string }[];
  ciudad: string | null;
  invitados: number | null;
  /** «Ana y Juan». */
  pareja: string | null;
  /** Día en que se envió esta versión, «dd/mm/aaaa». */
  emitido: string | null;
  /** Quién lo armó, del equipo. */
  preparadoPor: string | null;
};

export type DatosFicha = {
  cliente: { kind: string | null; firstName: string | null; lastName: string | null; businessName: string | null } | null;
  /** Lo de la consulta (null si el presupuesto no tiene). */
  consulta: {
    categoria: string | null;
    eventStartsAt: Date | null;
    eventTimeKnown: boolean;
    venue: string | null;
    ceremonyVenue: string | null;
    receptionVenue: string | null;
    city: string | null;
    guests: number | null;
    partnerOneName: string | null;
    partnerTwoName: string | null;
  } | null;
  /** Lo viejo de la consulta, por si la nueva no tiene fecha o lugar. */
  lead: { eventDate: Date | null; eventLocation: string | null } | null;
  enviado: Date | null;
  preparadoPor: string | null;
};

const ZONA = "America/Argentina/Buenos_Aires";
const DIA_LARGO = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
const DIA_LARGO_UTC = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const HORA = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA });
const DIA_CORTO = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA });
const AAAA_MM_DD = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });

const texto = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Días entre dos fechas «aaaa-mm-dd» (calendario, sin horas). */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export function textoFaltan(dias: number): string | null {
  if (dias < 0) return null;
  if (dias === 0) return "¡Es hoy!";
  if (dias === 1) return "Falta 1 día";
  if (dias < 60) return `Faltan ${dias} días`;
  return `Faltan ${Math.floor(dias / 30.44)} meses`;
}

export function armarFicha(d: DatosFicha, ahora: Date): FichaDeLaVista {
  const c = d.cliente;
  const empresa = c?.kind === "EMPRESA" ? texto(c.businessName) : null;
  const completo = empresa ?? (texto([c?.firstName, c?.lastName].filter(Boolean).join(" ")) || texto(c?.businessName));
  const nombrePila = empresa ? null : texto(c?.firstName?.split(/\s+/)[0]);

  const q = d.consulta;
  // Con hora conocida es un instante real (se muestra en hora argentina); sin hora, sólo vale el día
  // guardado (medianoche UTC), que se lee tal cual.
  const conHora = Boolean(q?.eventStartsAt && q.eventTimeKnown);
  const cuando = q?.eventStartsAt ?? d.lead?.eventDate ?? null;
  const diaDelEvento = cuando ? (conHora ? AAAA_MM_DD.format(cuando) : cuando.toISOString().slice(0, 10)) : null;
  const fecha = cuando ? (conHora ? DIA_LARGO : DIA_LARGO_UTC).format(cuando) : null;

  const lugares: FichaDeLaVista["lugares"] = [];
  const vistos = new Set<string>();
  const sumar = (etiqueta: string, v: string | null | undefined) => {
    const t = texto(v);
    if (t && !vistos.has(t.toLowerCase())) {
      vistos.add(t.toLowerCase());
      lugares.push({ etiqueta, valor: t });
    }
  };
  sumar("Ceremonia", q?.ceremonyVenue);
  sumar("Fiesta", q?.receptionVenue);
  sumar("Lugar", q?.venue);
  if (lugares.length === 0) sumar("Lugar", d.lead?.eventLocation);

  const pareja = [texto(q?.partnerOneName), texto(q?.partnerTwoName)].filter(Boolean).join(" y ") || null;

  return {
    cliente: completo,
    nombrePila,
    evento: texto(q?.categoria),
    fecha,
    hora: conHora && cuando ? HORA.format(cuando) : null,
    faltan: diaDelEvento ? textoFaltan(diasEntre(AAAA_MM_DD.format(ahora), diaDelEvento)) : null,
    lugares,
    ciudad: texto(q?.city),
    invitados: q?.guests && q.guests > 0 ? q.guests : null,
    pareja,
    emitido: d.enviado ? DIA_CORTO.format(d.enviado) : null,
    preparadoPor: texto(d.preparadoPor),
  };
}
