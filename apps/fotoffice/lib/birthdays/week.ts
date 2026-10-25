import { localMoment } from "@/lib/bookings/time";
import { normalizarUsuarioRed, urlDeUsuario } from "@/lib/membership/social";

/**
 * Los cumpleaños de la semana, para la portada del portal.
 *
 * Módulo puro. La semana es de lunes a domingo en la hora de la institución: es la semana que
 * cualquiera tiene en la cabeza, y no la del Socio de la semana (viernes a jueves), que existe
 * por cómo rota la tarjeta y no porque alguien piense así sus cumpleaños.
 *
 * Nunca se muestra el año ni la edad: el socio cargó la fecha para la institución, no para
 * que sus colegas sepan cuántos años tiene.
 */

export const BIRTHDAYS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type BirthdayMemberInput = {
  id: string;
  firstName: string;
  lastName: string;
  /** Fecha sin hora: se guarda como medianoche UTC, así que se lee en UTC. */
  birthDate: Date;
  instagram: string | null;
  photoUrl: string | null;
};

export type BirthdayView = {
  memberId: string;
  fullName: string;
  initials: string;
  photoUrl: string | null;
  /** "Lunes 5". */
  dayLabel: string;
  isToday: boolean;
  /** Ya pasó esta semana. */
  isPast: boolean;
  isViewer: boolean;
  instagramUrl: string | null;
  instagramUser: string | null;
};

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** Los siete días (lunes a domingo) de la semana de `now`, como fechas UTC sin hora. */
export function birthdayWeekDays(now: Date, timeZone = BIRTHDAYS_TIME_ZONE): Date[] {
  const local = localMoment(now, timeZone);
  const [y, m, d] = local.ymd.split("-").map(Number);
  const desdeElLunes = (local.weekday + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d - desdeElLunes + i)));
}

/** El día en que cae el cumpleaños dentro de la semana, o null si no cae. */
function diaDelCumple(birthDate: Date, dias: Date[]): number {
  const mes = birthDate.getUTCMonth();
  const dia = birthDate.getUTCDate();
  return dias.findIndex((d) => {
    if (d.getUTCMonth() === mes && d.getUTCDate() === dia) return true;
    // Quien nació un 29 de febrero lo festeja el 28 los años que no son bisiestos.
    return (
      mes === 1 &&
      dia === 29 &&
      !esBisiesto(d.getUTCFullYear()) &&
      d.getUTCMonth() === 1 &&
      d.getUTCDate() === 28
    );
  });
}

function iniciales(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toLocaleUpperCase("es-AR");
}

export function buildBirthdaysOfWeek(input: {
  members: BirthdayMemberInput[];
  now: Date;
  viewerMemberId?: string | null;
  timeZone?: string;
}): BirthdayView[] {
  const timeZone = input.timeZone ?? BIRTHDAYS_TIME_ZONE;
  const dias = birthdayWeekDays(input.now, timeZone);
  const hoy = (localMoment(input.now, timeZone).weekday + 6) % 7;

  const cumples = input.members.flatMap((m) => {
    const indice = diaDelCumple(m.birthDate, dias);
    if (indice < 0) return [];
    const fecha = dias[indice];
    // Un usuario mal cargado no rompe la tarjeta: se muestra la persona, sin el botón.
    const ig = normalizarUsuarioRed("instagram", m.instagram);
    const usuario = ig.ok ? ig.valor : null;
    const view: BirthdayView = {
      memberId: m.id,
      fullName: `${m.firstName.trim()} ${m.lastName.trim()}`.trim(),
      initials: iniciales(m.firstName, m.lastName),
      photoUrl: m.photoUrl,
      dayLabel: `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()}`,
      isToday: indice === hoy,
      isPast: indice < hoy,
      isViewer: m.id === input.viewerMemberId,
      instagramUrl: usuario ? urlDeUsuario("instagram", usuario) : null,
      instagramUser: usuario,
    };
    return [{ indice, view }];
  });

  return cumples
    .sort((a, b) => a.indice - b.indice || a.view.fullName.localeCompare(b.view.fullName, "es-AR"))
    .map((c) => c.view);
}
