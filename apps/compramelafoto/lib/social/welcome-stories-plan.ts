import { artDateKey, nextFreeStorySlots, STORY_QUEUE_HORIZON_DAYS } from "./album-stories-plan";

/**
 * Reglas de la historia de bienvenida (pedido 2026-11-24): una por fotógrafo, cuando sube
 * su primer álbum, y solo si tiene logo e Instagram cargados (sin eso no hay placa).
 */

/** Hasta cuántos días después del primer álbum se le puede dar la bienvenida. */
export const WELCOME_LOOKBACK_DAYS = 30;

/** Se espera un rato después del primer álbum: que termine de cargar el perfil. */
export const WELCOME_SETTLE_HOURS = 2;

/** Bienvenidas por día como mucho: comparten los horarios con las historias de álbumes. */
export const WELCOMES_PER_DAY = 3;

/** Horas (argentinas) en que sale una bienvenida: mañana, tarde y noche. */
export const WELCOME_HOURS_ART = [11, 16, 20] as const;

export type WelcomeCandidate = {
  role: string;
  isBlocked: boolean;
  logoUrl: string | null;
  handle: string | null;
  /** Tiene al menos un álbum real (no de prueba ni borrado). */
  hasRealAlbum: boolean;
  alreadyGenerated: boolean;
};

export type WelcomeSkipReason = "NOT_PHOTOGRAPHER" | "BLOCKED" | "NO_LOGO" | "NO_INSTAGRAM" | "ONLY_TEST_ALBUMS" | "ALREADY_GENERATED";

const ROLES_FOTOGRAFO = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

export function decideWelcome(c: WelcomeCandidate): { eligible: true } | { eligible: false; reason: WelcomeSkipReason } {
  if (c.alreadyGenerated) return { eligible: false, reason: "ALREADY_GENERATED" };
  if (!ROLES_FOTOGRAFO.has(c.role)) return { eligible: false, reason: "NOT_PHOTOGRAPHER" };
  if (c.isBlocked) return { eligible: false, reason: "BLOCKED" };
  if (!c.hasRealAlbum) return { eligible: false, reason: "ONLY_TEST_ALBUMS" };
  if (!c.logoUrl || !/^https?:\/\//.test(c.logoUrl.trim())) return { eligible: false, reason: "NO_LOGO" };
  if (!c.handle) return { eligible: false, reason: "NO_INSTAGRAM" };
  return { eligible: true };
}

/**
 * Horarios para `count` bienvenidas: los primeros libres de la agenda común de historias
 * (respeta el tope diario total), sin pasar de `WELCOMES_PER_DAY` bienvenidas por día.
 *
 * `taken`: todo lo que ya ocupa horario (álbumes y bienvenidas). `welcomesTaken`: solo las
 * bienvenidas ya agendadas, para el tope propio. Si no hay lugar, devuelve menos.
 */
export function planWelcomeSlots(
  taken: Date[],
  welcomesTaken: Date[],
  now: Date,
  count: number,
  perDay = WELCOMES_PER_DAY,
  horizonDays = STORY_QUEUE_HORIZON_DAYS,
): Date[] {
  if (count <= 0) return [];
  const porDia = new Map<string, number>();
  for (const d of welcomesTaken) porDia.set(artDateKey(d), (porDia.get(artDateKey(d)) ?? 0) + 1);
  // Todos los lugares libres del horizonte; de ahí se eligen respetando el tope propio.
  const libres = nextFreeStorySlots(taken, now, 10_000, horizonDays);
  // Una por horario, y solo en las horas de bienvenida: así no se amontonan en la mañana.
  const horas = new Set<number>(WELCOME_HOURS_ART);
  const claveHora = (d: Date) => `${artDateKey(d)}-${(d.getUTCHours() + 21) % 24}`;
  const usadasPorDiaHora = new Set<string>(welcomesTaken.map(claveHora));
  const elegidos: Date[] = [];
  for (const slot of libres) {
    if (elegidos.length >= count) break;
    const dia = artDateKey(slot);
    if ((porDia.get(dia) ?? 0) >= perDay) continue;
    if (!horas.has((slot.getUTCHours() + 21) % 24)) continue;
    const hora = claveHora(slot);
    if (usadasPorDiaHora.has(hora)) continue;
    elegidos.push(slot);
    usadasPorDiaHora.add(hora);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  return elegidos.sort((a, b) => a.getTime() - b.getTime());
}
