/**
 * Reglas puras de las historias diarias de álbumes (sin base, sin red): qué álbum entra,
 * qué fotos se usan y a qué hora sale cada historia. Se testean en
 * `album-stories-plan.test.ts`; la persistencia vive en `album-stories.ts`.
 *
 * Decisiones (2026-11-21):
 * - Solo historias, nada en el feed.
 * - Solo álbumes públicos de más de 50 fotos. Nunca privados, ocultos, protegidos por
 *   selfie, de prueba ni escolares: ahí hay menores o gente que no eligió ser vista.
 * - El permiso es por álbum y viene ACTIVADO por defecto; el fotógrafo lo apaga desde
 *   «Privacidad y acceso». Solo el «no» explícito queda guardado.
 * - Las fotos se eligen solas, repartidas a lo largo del álbum; si el fotógrafo marcó
 *   fotos para redes, se usan esas primero.
 * - Hasta 10 historias por día. Lo que no entra hoy queda en espera para los días
 *   siguientes, con un horizonte de 7 días.
 * - Salen solas a su hora; el admin puede sacarlas de la cola antes (veto).
 */

/** Más de 50 fotos: con menos, el álbum no tiene volumen para una historia. */
export const MIN_ALBUM_PHOTOS_FOR_STORY = 51;

/** Tope diario de historias. */
export const MAX_STORIES_PER_DAY = 10;

/** Cuántos días hacia adelante puede esperar una historia en la cola. */
export const STORY_QUEUE_HORIZON_DAYS = 7;

/**
 * Horarios de salida, hora argentina. Diez, en hora justa, repartidos entre la mañana y
 * la noche para que la cuenta tenga siempre algo vivo (una historia dura 24 h).
 *
 * Van en hora justa a propósito: el cron que publica (`social-publish` en `vercel.json`)
 * corre SOLO a estas diez horas y no cada 5 minutos, para no gastar invocaciones. Si se
 * cambia un horario acá, hay que cambiarlo también allá (lo controla un test).
 */
export const STORY_SLOTS_ART = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
] as const;

/** Argentina no tiene horario de verano: UTC−3 fijo. */
const ART_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Margen mínimo entre que se arma una historia y que sale. Chico: el cron diario corre a
 * las 08:00, así que el primer horario del día (10:00) siempre queda disponible.
 */
const MIN_LEAD_MS = 10 * 60 * 1000;

export type AlbumStoryCandidate = {
  isPublic: boolean;
  isHidden: boolean;
  hiddenPhotosEnabled: boolean;
  isTest: boolean;
  schoolId: number | null;
  deletedAt: Date | null;
  photoCount: number;
  /** `false` solo si el fotógrafo apagó el permiso; `null` = nunca lo tocó = permitido. */
  consentGiven: boolean | null;
  alreadyGenerated: boolean;
};

export type AlbumStorySkipReason =
  | "ALREADY_GENERATED"
  | "DELETED"
  | "NOT_PUBLIC"
  | "HIDDEN"
  | "SELFIE_PROTECTED"
  | "TEST_ALBUM"
  | "SCHOOL_ALBUM"
  | "NO_CONSENT"
  | "TOO_FEW_PHOTOS";

export type AlbumStoryDecision =
  | { eligible: true }
  | { eligible: false; reason: AlbumStorySkipReason };

/**
 * Decide si un álbum entra en las historias. El orden importa solo para el motivo que
 * se informa; cualquier «no» alcanza para no generar nada.
 */
export function decideAlbumStory(a: AlbumStoryCandidate): AlbumStoryDecision {
  if (a.alreadyGenerated) return { eligible: false, reason: "ALREADY_GENERATED" };
  if (a.deletedAt) return { eligible: false, reason: "DELETED" };
  if (a.isTest) return { eligible: false, reason: "TEST_ALBUM" };
  if (!a.isPublic) return { eligible: false, reason: "NOT_PUBLIC" };
  if (a.isHidden) return { eligible: false, reason: "HIDDEN" };
  if (a.hiddenPhotosEnabled) return { eligible: false, reason: "SELFIE_PROTECTED" };
  if (a.schoolId != null) return { eligible: false, reason: "SCHOOL_ALBUM" };
  if (a.consentGiven === false) return { eligible: false, reason: "NO_CONSENT" };
  if (a.photoCount < MIN_ALBUM_PHOTOS_FOR_STORY) return { eligible: false, reason: "TOO_FEW_PHOTOS" };
  return { eligible: true };
}

/**
 * Elige `count` fotos. Primero las que el fotógrafo marcó para redes (si siguen en el
 * álbum), después fotos repartidas a lo largo del álbum: tomar las primeras N daría
 * cuatro fotos casi iguales de la largada.
 *
 * `available` tiene que venir en el orden del álbum y solo con fotos que tengan versión
 * con marca de agua.
 */
export function pickStoryPhotos(available: number[], count: number, preferred: number[] = []): number[] {
  const disponibles = new Set(available);
  const elegidas: number[] = [];
  for (const id of preferred) {
    if (elegidas.length >= count) break;
    if (disponibles.has(id) && !elegidas.includes(id)) elegidas.push(id);
  }
  const resto = available.filter((id) => !elegidas.includes(id));
  const faltan = count - elegidas.length;
  if (faltan <= 0 || resto.length === 0) return elegidas;
  if (resto.length <= faltan) return [...elegidas, ...resto];
  // Centro de cada tramo: con 4 fotos sobre 100, toma ~12, ~37, ~62 y ~87.
  const paso = resto.length / faltan;
  for (let i = 0; i < faltan; i++) {
    elegidas.push(resto[Math.min(resto.length - 1, Math.floor(paso * i + paso / 2))]!);
  }
  return elegidas;
}

/** Fecha argentina (AAAA-MM-DD) de un instante. */
export function artDateKey(d: Date): string {
  return new Date(d.getTime() + ART_OFFSET_MS).toISOString().slice(0, 10);
}

function slotInstant(dateKey: string, hhmm: string): Date {
  // "2026-11-21T10:00:00-03:00"
  return new Date(`${dateKey}T${hhmm}:00-03:00`);
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Devuelve hasta `count` horarios libres, del más cercano al más lejano, sin pasar de
 * `MAX_STORIES_PER_DAY` por día argentino ni del horizonte de la cola.
 *
 * `taken` son los horarios de las historias que ya están en la cola o que ya salieron
 * hoy: cuentan para el tope del día aunque se hayan publicado.
 */
export function nextFreeStorySlots(
  taken: Date[],
  now: Date,
  count: number,
  horizonDays = STORY_QUEUE_HORIZON_DAYS,
): Date[] {
  const ocupados = new Set(taken.map((d) => d.getTime()));
  const porDia = new Map<string, number>();
  for (const d of taken) porDia.set(artDateKey(d), (porDia.get(artDateKey(d)) ?? 0) + 1);

  const libres: Date[] = [];
  const hoy = artDateKey(now);
  for (let dia = 0; dia < horizonDays && libres.length < count; dia++) {
    const key = addDays(hoy, dia);
    let usados = porDia.get(key) ?? 0;
    for (const hhmm of STORY_SLOTS_ART) {
      if (libres.length >= count || usados >= MAX_STORIES_PER_DAY) break;
      const t = slotInstant(key, hhmm);
      if (t.getTime() < now.getTime() + MIN_LEAD_MS) continue;
      if (ocupados.has(t.getTime())) continue;
      libres.push(t);
      usados++;
    }
  }
  return libres;
}

/** Crédito impreso: con @ si el fotógrafo cargó su Instagram, si no, su nombre. */
export function storyCredit(handle: string | null, name: string | null): string {
  if (handle) return `Fotos de @${handle}`;
  const n = name?.trim();
  return n ? `Fotos de ${n.slice(0, 36)}` : "";
}

/** El nombre del álbum, recortado para que entre en dos líneas de la plantilla. */
export function storyAlbumTitle(name: string): string {
  const limpio = name.replace(/\s+/g, " ").trim();
  return limpio.length > 60 ? `${limpio.slice(0, 57).trimEnd()}…` : limpio;
}
