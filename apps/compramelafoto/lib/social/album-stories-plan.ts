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

/** Tope diario de historias, sumando todos los álbumes. */
export const MAX_STORIES_PER_DAY = 10;

/** Historias por álbum, cada una en un día distinto (pedido 2026-11-21). */
export const STORIES_PER_ALBUM = 3;

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
 * `available` tiene que venir en el orden del álbum.
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

/** El nombre del álbum, recortado para que entre en las dos líneas de la plantilla (~45 por línea). */
export function storyAlbumTitle(name: string): string {
  const limpio = name.replace(/\s+/g, " ").trim();
  return limpio.length > 80 ? `${limpio.slice(0, 77).trimEnd()}…` : limpio;
}

/**
 * Dirección corta del álbum para imprimir en la historia: `compramelafoto.com/a/1557`.
 * El link no se puede tocar (Meta no deja poner el sticker por API), así que tiene que
 * poder leerse y copiarse a mano; la del título completo es ilegible. `/a/{id}` redirige
 * a la página pública del álbum.
 */
export function storyShortUrl(albumId: number): string {
  return `compramelafoto.com/a/${albumId}`;
}

/**
 * Agenda las historias de varios álbumes: hasta `porAlbum` por álbum, **cada una en un
 * día distinto** del de la anterior, sin pasar de `MAX_STORIES_PER_DAY` por día.
 *
 * Va por rondas: primero la historia 1 de todos los álbumes, después la 2 y después la
 * 3. Así un evento nuevo nunca queda atrás de la tercera historia de otro. Si para una
 * historia no hay lugar dentro del horizonte, ese álbum se queda con las que ya tiene.
 *
 * Devuelve, por álbum (en el mismo orden), los horarios asignados: de 0 a `porAlbum`.
 */
export function planAlbumStories(
  taken: Date[],
  now: Date,
  cantidadDeAlbumes: number,
  porAlbum = STORIES_PER_ALBUM,
  horizonDays = STORY_QUEUE_HORIZON_DAYS,
): Date[][] {
  const ocupados = [...taken];
  const plan: Date[][] = Array.from({ length: cantidadDeAlbumes }, () => []);
  const hoy = artDateKey(now);
  for (let ronda = 0; ronda < porAlbum; ronda++) {
    for (let a = 0; a < cantidadDeAlbumes; a++) {
      const previas = plan[a]!;
      if (previas.length < ronda) continue; // ya se quedó sin lugar en una ronda anterior
      const desde = ronda === 0 ? hoy : addDays(artDateKey(previas[previas.length - 1]!), 1);
      const slot = primerHorarioLibre(ocupados, now, desde, hoy, horizonDays);
      if (!slot) continue;
      previas.push(slot);
      ocupados.push(slot);
    }
  }
  return plan;
}

function primerHorarioLibre(taken: Date[], now: Date, desdeDia: string, hoy: string, horizonDays: number): Date | null {
  const ocupados = new Set(taken.map((d) => d.getTime()));
  const porDia = new Map<string, number>();
  for (const d of taken) porDia.set(artDateKey(d), (porDia.get(artDateKey(d)) ?? 0) + 1);
  for (let dia = 0; dia < horizonDays; dia++) {
    const key = addDays(hoy, dia);
    if (key < desdeDia) continue;
    if ((porDia.get(key) ?? 0) >= MAX_STORIES_PER_DAY) continue;
    for (const hhmm of STORY_SLOTS_ART) {
      const t = slotInstant(key, hhmm);
      if (t.getTime() < now.getTime() + MIN_LEAD_MS) continue;
      if (!ocupados.has(t.getTime())) return t;
    }
  }
  return null;
}

/**
 * Reparte las fotos elegidas entre las historias de un álbum, alternando (la 1.ª a la
 * historia 1, la 2.ª a la 2, …) para que cada historia tenga fotos de todo el evento y
 * ninguna foto se repita. `cantidades` es cuántas pide cada plantilla (3 o 4).
 */
export function repartirFotos(elegidas: number[], cantidades: number[]): number[][] {
  const reparto: number[][] = cantidades.map(() => []);
  let i = 0;
  let avanzo = true;
  while (i < elegidas.length && avanzo) {
    avanzo = false;
    for (let h = 0; h < cantidades.length && i < elegidas.length; h++) {
      if (reparto[h]!.length < cantidades[h]!) {
        reparto[h]!.push(elegidas[i++]!);
        avanzo = true;
      }
    }
  }
  return reparto;
}

/**
 * Frase grande de la historia, según el día de la secuencia (pedido 2026-11-22). El día 1
 * avisa que salieron, el 2 invita a buscarse y el 3 empuja a no quedarse sin ellas. Dentro
 * de cada día se elige una variante según el álbum, para que no se lea siempre igual.
 * Todas entran en una línea de la plantilla (≤ 32 caracteres).
 */
export const FRASES_POR_DIA: readonly (readonly string[])[] = [
  ["¡Ya están disponibles!", "¡Buscá tus fotos!", "Las fotos ya están online", "¡Ya salieron las fotos!", "Tus fotos te esperan"],
  ["¿Ya encontraste tus fotos?", "¿Saliste en la foto?", "Encontrate en el álbum", "¿Estuviste? Buscate acá", "Mirá si estás en las fotos"],
  ["¡No te quedes sin las tuyas!", "Revivilo con tus fotos", "¿Ya te buscaste?", "Llevate el recuerdo", "¡Todavía estás a tiempo!"],
];

export function fraseDeHistoria(numeroDeHistoria: number, albumId: number): string {
  const dia = Math.min(Math.max(Math.trunc(numeroDeHistoria), 1), FRASES_POR_DIA.length) - 1;
  const opciones = FRASES_POR_DIA[dia]!;
  return opciones[((Math.trunc(albumId) % opciones.length) + opciones.length) % opciones.length]!;
}
