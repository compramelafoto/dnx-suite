/**
 * La ventana de activación del evento (capítulo 7.4 del documento maestro).
 *
 * El fotógrafo elige una hora local y el evento queda abierto 12 horas. "12 horas
 * consecutivas" son 12 horas reales: si en el medio cambia el horario de verano, el reloj
 * de la pared va a marcar una hora distinta de la esperada, y eso está bien — el evento
 * duró lo que tenía que durar.
 *
 * Sin librerías de fechas: `Intl.DateTimeFormat` con `timeZone` ya sabe de zonas y de
 * horario de verano, y viene en Node.
 */

export type EntradaVentana = {
  /** Hora local elegida por el fotógrafo, sin zona: "2026-10-10T20:00". */
  fechaHoraLocal: string;
  /** Zona IANA: "America/Argentina/Buenos_Aires". */
  zonaHoraria: string;
  /** Duración en horas. 12 salvo que se diga otra cosa. */
  horas?: number;
};

export type Ventana = {
  activacionUtc: Date;
  desactivacionUtc: Date;
  desactivacionLocal: {
    fecha: string;
    hora: string;
    /** Para el aviso "cierra mañana a las 08:00" antes de confirmar. */
    esDiaSiguiente: boolean;
  };
};

const PATRON = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Descompone un instante en las partes que muestra el reloj de esa zona. */
function partesEnZona(instante: Date, zonaHoraria: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(instante)) p[type] = value;

  // Intl devuelve "24" para medianoche en algunas versiones de Node.
  const hora = p.hour === "24" ? "00" : p.hour;

  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${hora}:${p.minute}`,
    comoUtc: Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(hora),
      Number(p.minute),
      Number(p.second),
    ),
  };
}

/**
 * Convierte una hora local de una zona al instante real (UTC).
 *
 * No hay forma directa en la plataforma: se estima, se mira qué hora marca esa estimación
 * en la zona, y se corrige por la diferencia. Dos pasadas alcanzan incluso cuando el
 * desfase cambia justo en el medio, que es lo que pasa en los cambios de horario.
 */
function localAUtc(fechaHoraLocal: string, zonaHoraria: string): Date {
  const m = PATRON.exec(fechaHoraLocal);
  if (!m) {
    throw new Error(
      `Fecha y hora inválidas: "${fechaHoraLocal}". Se espera "AAAA-MM-DDTHH:MM".`,
    );
  }

  const [, a, mes, d, h, min] = m;
  const deseado = Date.UTC(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min), 0);

  let instante = deseado;
  for (let i = 0; i < 2; i++) {
    const desfase = partesEnZona(new Date(instante), zonaHoraria).comoUtc - instante;
    instante = deseado - desfase;
  }

  return new Date(instante);
}

export function calcularVentana(entrada: EntradaVentana): Ventana {
  const horas = entrada.horas ?? 12;
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new Error(`La ventana debe durar más de cero horas, y llegó ${horas}.`);
  }

  const activacionUtc = localAUtc(entrada.fechaHoraLocal, entrada.zonaHoraria);
  const desactivacionUtc = new Date(activacionUtc.getTime() + horas * 3_600_000);

  const inicio = partesEnZona(activacionUtc, entrada.zonaHoraria);
  const fin = partesEnZona(desactivacionUtc, entrada.zonaHoraria);

  return {
    activacionUtc,
    desactivacionUtc,
    desactivacionLocal: {
      fecha: fin.fecha,
      hora: fin.hora,
      esDiaSiguiente: fin.fecha !== inicio.fecha,
    },
  };
}
