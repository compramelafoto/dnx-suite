import { MAX_HIGHLIGHTS, MAX_WORKS } from "./constants";
import { stableHash } from "./curation";
import { temporalStatus, toArDay } from "./dates";
import { sameName } from "./names";

/**
 * La sorpresa de la muestra (etapa 6). Qué se ve de las obras **expuestas** según por dónde entra
 * cada persona: la publicación online, el perfil del artista o el QR de la sala. Es la única regla
 * que interpreta `CulturalActivity.visibility`: todo lo demás la lee con `parseVisibility`.
 */
export const ONLINE_EXHIBITED = ["ALL", "HIGHLIGHTS", "RANDOM", "NONE"] as const;
export type OnlineExhibited = (typeof ONLINE_EXHIBITED)[number];
export const RANDOM_ROTATIONS = ["FIXED", "DAILY", "PER_VISIT"] as const;
export type RandomRotation = (typeof RANDOM_ROTATIONS)[number];
export const PROFILE_EXHIBITED = ["LIKE_ONLINE", "NONE"] as const;
export type ProfileExhibited = (typeof PROFILE_EXHIBITED)[number];
export const ROOM_EXHIBITED = ["SCANNED", "ARTIST", "ALL"] as const;
export type RoomExhibited = (typeof ROOM_EXHIBITED)[number];
export const VISIBILITY_PRESETS = ["PREVIEW", "SURPRISE", "HIGHLIGHTS", "OPEN", "CUSTOM"] as const;
export type VisibilityPreset = (typeof VISIBILITY_PRESETS)[number];
export type FixedVisibilityPreset = Exclude<VisibilityPreset, "CUSTOM">;

const es = <T extends string>(lista: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (lista as readonly string[]).includes(v);
export const isOnlineExhibited = es(ONLINE_EXHIBITED);
export const isRandomRotation = es(RANDOM_ROTATIONS);
export const isProfileExhibited = es(PROFILE_EXHIBITED);
export const isRoomExhibited = es(ROOM_EXHIBITED);
export const isVisibilityPreset = es(VISIBILITY_PRESETS);

export const VISIBILITY_PRESET_LABELS: Record<VisibilityPreset, string> = {
  PREVIEW: "Adelanto",
  SURPRISE: "Sorpresa total",
  HIGHLIGHTS: "Destacadas",
  OPEN: "Todo a la vista",
  CUSTOM: "Personalizado",
};
export const VISIBILITY_PRESET_DESCRIPTIONS: Record<VisibilityPreset, string> = {
  PREVIEW: "Online se ven unas pocas obras de la sala elegidas al azar. Los artistas se presentan con su biografía y su portfolio.",
  SURPRISE: "Online no se ve ninguna obra de la sala: sólo los artistas y su portfolio. Todo se descubre en la sala.",
  HIGHLIGHTS: "Online se ven las obras que marques como destacadas, hasta que cierra la muestra.",
  OPEN: "Online se ven todas las obras de la sala.",
  CUSTOM: "Elegís cada opción.",
};
export const ONLINE_EXHIBITED_LABELS: Record<OnlineExhibited, string> = {
  ALL: "Todas",
  HIGHLIGHTS: "Las destacadas",
  RANDOM: "Una cantidad al azar",
  NONE: "Ninguna",
};
export const RANDOM_ROTATION_LABELS: Record<RandomRotation, string> = {
  FIXED: "Siempre las mismas",
  DAILY: "Cambian cada día",
  PER_VISIT: "Cambian para cada visitante",
};
export const PROFILE_EXHIBITED_LABELS: Record<ProfileExhibited, string> = {
  LIKE_ONLINE: "Como en la publicación online",
  NONE: "Ninguna",
};
export const ROOM_EXHIBITED_LABELS: Record<RoomExhibited, string> = {
  SCANNED: "Sólo la obra escaneada",
  ARTIST: "La obra y las demás del mismo artista",
  ALL: "Toda la muestra",
};

export const DEFAULT_RANDOM_COUNT = 3;
const SEED_MAX = 64;
const SEED_LEGADO = "legado";

export type Visibility = {
  v: 1;
  preset: VisibilityPreset;
  online: { exhibited: OnlineExhibited; randomCount: number; rotation: RandomRotation; seed: string; artists: boolean };
  profile: { exhibited: ProfileExhibited };
  room: { exhibited: RoomExhibited; portfolio: boolean; otherExhibitions: boolean; buy: boolean };
  revealAfterClose: boolean;
};

export function visibilityFromPreset(preset: FixedVisibilityPreset, seed: string): Visibility {
  const exhibited = ({ PREVIEW: "RANDOM", SURPRISE: "NONE", HIGHLIGHTS: "HIGHLIGHTS", OPEN: "ALL" } as const)[preset];
  return {
    v: 1,
    preset,
    online: { exhibited, randomCount: DEFAULT_RANDOM_COUNT, rotation: "FIXED", seed, artists: true },
    // "Sorpresa total": el perfil tampoco muestra obras de la sala (tabla de presets del spec).
    profile: { exhibited: preset === "SURPRISE" ? "NONE" : "LIKE_ONLINE" },
    room: { exhibited: "ARTIST", portfolio: true, otherExhibitions: true, buy: true },
    revealAfterClose: true,
  };
}

/** Lo que distingue a un ajuste de otro (sin semilla ni nombre del preset). */
function huella(v: Visibility): string {
  const azar = v.online.exhibited === "RANDOM" ? { randomCount: v.online.randomCount, rotation: v.online.rotation } : {};
  return JSON.stringify({
    online: { exhibited: v.online.exhibited, ...azar, artists: v.online.artists },
    profile: v.profile,
    room: v.room,
    revealAfterClose: v.revealAfterClose,
  });
}

/** El preset que coincide con el ajuste, o "Personalizado". */
export function presetOf(v: Visibility): VisibilityPreset {
  const h = huella(v);
  const fijos = VISIBILITY_PRESETS.filter((p): p is FixedVisibilityPreset => p !== "CUSTOM");
  return fijos.find((p) => huella(visibilityFromPreset(p, v.online.seed)) === h) ?? "CUSTOM";
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const bool = (x: unknown, porDefecto: boolean) => (typeof x === "boolean" ? x : porDefecto);

/**
 * Siempre devuelve un ajuste completo y válido. Vacío (o de otra versión) → como hasta la etapa 5
 * según `galleryMode` (spec D24). Un campo roto se reemplaza por el del legado.
 */
export function parseVisibility(json: unknown, galleryMode: string): Visibility {
  const legado = visibilityFromPreset(galleryMode === "FULL" ? "OPEN" : "HIGHLIGHTS", SEED_LEGADO);
  if (!esObjeto(json) || json.v !== 1) return legado;
  const on = esObjeto(json.online) ? json.online : {};
  const pr = esObjeto(json.profile) ? json.profile : {};
  const ro = esObjeto(json.room) ? json.room : {};
  const n = on.randomCount;
  const seed = typeof on.seed === "string" && on.seed.length >= 1 && on.seed.length <= SEED_MAX ? on.seed : SEED_LEGADO;
  const v: Visibility = {
    v: 1,
    preset: "CUSTOM",
    online: {
      exhibited: isOnlineExhibited(on.exhibited) ? on.exhibited : legado.online.exhibited,
      // Sin tope propio, pero nunca más que el tope técnico de obras de una muestra.
      randomCount: typeof n === "number" && Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_WORKS) : DEFAULT_RANDOM_COUNT,
      rotation: isRandomRotation(on.rotation) ? on.rotation : "FIXED",
      seed,
      artists: bool(on.artists, legado.online.artists),
    },
    profile: { exhibited: isProfileExhibited(pr.exhibited) ? pr.exhibited : legado.profile.exhibited },
    room: {
      exhibited: isRoomExhibited(ro.exhibited) ? ro.exhibited : legado.room.exhibited,
      portfolio: bool(ro.portfolio, legado.room.portfolio),
      otherExhibitions: bool(ro.otherExhibitions, legado.room.otherExhibitions),
      buy: bool(ro.buy, legado.room.buy),
    },
    revealAfterClose: bool(json.revealAfterClose, legado.revealAfterClose),
  };
  return { ...v, preset: presetOf(v) };
}

/** Orden determinista por semilla (y día, en "cambian cada día"): la página sigue en caché. */
function sorteo<W extends { id: string }>(works: readonly W[], seed: string, day: string | null): W[] {
  const clave = new Map(works.map((w) => [w.id, stableHash(`muestras-sorpresa:v1:${seed}:${day ?? ""}:${w.id}`)]));
  return [...works].sort((a, b) => {
    const x = clave.get(a.id)!;
    const y = clave.get(b.id)!;
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

export type OnlineExhibitedResult<W> =
  | { mode: "STATIC"; works: W[]; isPartial: boolean; hiddenCount: number }
  | { mode: "PER_VISIT"; count: number; total: number };

/**
 * Qué obras expuestas ve la publicación online. En "para cada visitante" (muestra sin revelar)
 * **no devuelve obras**: quien arma la página no tiene nada que mandar al navegador; las elige
 * `/api/m/<slug>/anticipo` en cada pedido.
 */
export function onlineExhibitedWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  v: Visibility,
  a: { startsAt: Date; endsAt: Date },
  works: readonly W[],
  now: Date,
): OnlineExhibitedResult<W> {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  const todo = { mode: "STATIC" as const, works: ordered, isPartial: false, hiddenCount: 0 };
  if (temporalStatus(a, now) === "CLOSED" && v.revealAfterClose) return todo;
  const estatico = (shown: W[]) => ({
    mode: "STATIC" as const,
    works: shown,
    isPartial: shown.length < ordered.length,
    hiddenCount: ordered.length - shown.length,
  });
  switch (v.online.exhibited) {
    case "ALL":
      return todo;
    case "NONE":
      return estatico([]);
    case "HIGHLIGHTS": {
      const h = ordered.filter((w) => w.isHighlight);
      return estatico((h.length > 0 ? h : ordered).slice(0, MAX_HIGHLIGHTS));
    }
    case "RANDOM": {
      if (v.online.randomCount >= ordered.length) return todo;
      if (v.online.rotation === "PER_VISIT") return { mode: "PER_VISIT", count: v.online.randomCount, total: ordered.length };
      const dia = v.online.rotation === "DAILY" ? toArDay(now) : null;
      const elegidas = new Set(sorteo(ordered, v.online.seed, dia).slice(0, v.online.randomCount).map((w) => w.id));
      return estatico(ordered.filter((w) => elegidas.has(w.id)));
    }
  }
}

/**
 * N obras distintas con el azar que pasa la app (`crypto.randomInt`), en el orden de la galería.
 * Fisher–Yates parcial: `randomInt(max)` devuelve un entero en [0, max).
 */
export function pickPerVisit<W extends { sortOrder: number }>(works: readonly W[], n: number, randomInt: (max: number) => number): W[] {
  const pool = [...works];
  const k = Math.max(0, Math.min(n, pool.length));
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k).sort((x, y) => x.sortOrder - y.sortOrder);
}

/** Qué obras expuestas ve quien escaneó el QR de una o más fichas en la sala. */
export function roomExhibitedWorks<W extends { id: string; sortOrder: number; authorProfileId: string | null; authorName: string }>(
  v: Visibility,
  works: readonly W[],
  scannedIds: readonly string[],
): W[] {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  const escaneadas = ordered.filter((w) => scannedIds.includes(w.id));
  if (escaneadas.length === 0) return [];
  if (v.room.exhibited === "ALL") return ordered;
  if (v.room.exhibited === "SCANNED") return escaneadas;
  const mismoArtista = (w: W) =>
    escaneadas.some((e) =>
      e.authorProfileId
        ? e.authorProfileId === w.authorProfileId
        : !w.authorProfileId && sameName(e.authorName, w.authorName),
    );
  return ordered.filter(mismoArtista);
}

function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/** "Qué ve cada uno", en frases para el panel. */
export function visibilitySummary(v: Visibility): { online: string; profile: string; room: string; afterClose: string } {
  const n = v.online.randomCount;
  const obras = n === 1 ? "1 obra de la sala elegida al azar" : `${n} obras de la sala elegidas al azar`;
  const artistas = "presenta a los artistas con su biografía y su portfolio";
  let online: string;
  if (v.online.exhibited === "RANDOM" && v.online.rotation === "PER_VISIT") {
    const que = `La publicación online muestra ${obras}, ${n === 1 ? "distinta" : "distintas"} para cada visitante`;
    online = v.online.artists ? `${que}, y ${artistas}.` : `${que}.`;
  } else {
    const que = {
      ALL: "muestra todas las obras de la sala",
      NONE: "no muestra ninguna obra de la sala",
      HIGHLIGHTS: "muestra las obras destacadas",
      RANDOM: `muestra ${obras} (${v.online.rotation === "DAILY" ? "cambian cada día" : n === 1 ? "siempre la misma" : "siempre las mismas"})`,
    }[v.online.exhibited];
    online = `La publicación online ${que}${v.online.artists ? ` y ${artistas}` : ""}.`;
  }
  const profile =
    v.profile.exhibited === "NONE"
      ? "El perfil de cada artista no muestra sus obras de la sala: sólo su portfolio."
      : "El perfil de cada artista muestra sus obras de la sala como la publicación online, y su portfolio.";
  const salaObras = { SCANNED: "esa obra", ARTIST: "esa obra y las demás del mismo artista", ALL: "toda la muestra" }[v.room.exhibited];
  const extras = [
    ...(v.room.portfolio ? ["su portfolio"] : []),
    ...(v.room.otherExhibitions ? ["las otras muestras donde expuso"] : []),
    ...(v.room.buy ? ["el botón para adquirir la obra"] : []),
  ];
  const room = `Quien escanea el QR de una ficha ve ${enumerar([salaObras, ...extras])}.`;
  const afterClose = v.revealAfterClose
    ? "Cuando la muestra cierra, online se ven todas las obras."
    : "Cuando la muestra cierra, se mantiene la reserva: las obras de la sala siguen sin verse online.";
  return { online, profile, room, afterClose };
}

/** La portada de la muestra es la imagen de una obra que online queda reservada (spec D28). */
export function coverIsHiddenWork(
  cover: string | null | undefined,
  works: ReadonlyArray<{ id: string; imageUrl: string }>,
  shownIds: ReadonlySet<string>,
): boolean {
  if (!cover) return false;
  return works.some((w) => w.imageUrl === cover && !shownIds.has(w.id));
}
