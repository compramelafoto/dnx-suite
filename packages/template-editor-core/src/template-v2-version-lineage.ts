/**
 * De dónde sale cada versión de una plantilla, y cómo se llaman sus bloques en la versión de la
 * que salió.
 *
 * Una versión que ya usa alguien (un diseño armado, un carnet impreso, una edición fijada) no se
 * pisa: al guardar, el editor crea una versión nueva y la vieja queda congelada. Los bloques de la
 * nueva llevan otros ids (en la base el id de un bloque es único entre todas las versiones), así
 * que la versión nueva anota de cuál salió y qué id nuevo le tocó a cada bloque. Con eso un diseño
 * armado sobre la versión vieja puede pasarse a la nueva conservando la foto y el encuadre de cada
 * hueco.
 *
 * Estas marcas viven en `TemplateV2Version.metaJson` y las escribe sólo el servidor: al guardar se
 * conserva lo que tenía la base, venga lo que venga del navegador.
 *
 * Puro: sin base ni Node. Lo usan el servidor, el editor y los tests.
 */

/** Clave en `metaJson`: la versión de la que salió esta, con el mapa de ids de bloques. */
export const TEMPLATE_V2_VERSION_ORIGIN_META_KEY = "origenDeVersion";

/**
 * Clave en `metaJson`: la versión es una copia privada de un solo diseño (se retocó a mano). No es
 * la vigente de la plantilla, no aparece en la lista de versiones y no recibe cambios de la
 * plantilla.
 */
export const TEMPLATE_V2_PRIVATE_COPY_META_KEY = "copiaPrivada";

/** Las marcas que escribe sólo el servidor. */
export const TEMPLATE_V2_SERVER_OWNED_META_KEYS = [
  TEMPLATE_V2_VERSION_ORIGIN_META_KEY,
  TEMPLATE_V2_PRIVATE_COPY_META_KEY,
] as const;

export type TemplateV2VersionOriginReason =
  /** Se guardó la plantilla y la versión anterior estaba en uso. */
  | "en-uso"
  /** «Guardar como nueva versión» en el editor. */
  | "nueva-version"
  /** Copia privada para retocar un solo diseño. */
  | "copia-privada";

export type TemplateV2VersionOrigin = {
  versionId: string;
  /** id del bloque en la versión de origen → id en esta versión. Los borrados no figuran. */
  blockIdMap: Record<string, string>;
  at: string;
  reason: TemplateV2VersionOriginReason;
};

export type TemplateV2PrivateCopy = {
  /** Quién es el dueño de la copia, en la app que la creó (p. ej. "design-project"). */
  kind: string;
  id: string;
  at: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function readVersionOrigin(meta: unknown): TemplateV2VersionOrigin | null {
  const raw = asRecord(asRecord(meta)?.[TEMPLATE_V2_VERSION_ORIGIN_META_KEY]);
  if (!raw || typeof raw.versionId !== "string" || !raw.versionId) return null;
  const map: Record<string, string> = {};
  for (const [from, to] of Object.entries(asRecord(raw.blockIdMap) ?? {})) {
    if (typeof to === "string" && to) map[from] = to;
  }
  const reason = raw.reason;
  return {
    versionId: raw.versionId,
    blockIdMap: map,
    at: typeof raw.at === "string" ? raw.at : "",
    reason: reason === "nueva-version" || reason === "copia-privada" ? reason : "en-uso",
  };
}

export function readPrivateCopy(meta: unknown): TemplateV2PrivateCopy | null {
  const raw = asRecord(asRecord(meta)?.[TEMPLATE_V2_PRIVATE_COPY_META_KEY]);
  if (!raw || typeof raw.kind !== "string" || typeof raw.id !== "string") return null;
  return { kind: raw.kind, id: raw.id, at: typeof raw.at === "string" ? raw.at : "" };
}

export function isPrivateCopyMeta(meta: unknown): boolean {
  return readPrivateCopy(meta) != null;
}

/** La meta sin las marcas del servidor (lo que llega del navegador no puede escribirlas). */
export function withoutServerOwnedMeta(meta: unknown): Record<string, unknown> {
  const base = { ...(asRecord(meta) ?? {}) };
  for (const key of TEMPLATE_V2_SERVER_OWNED_META_KEYS) delete base[key];
  return base;
}

/**
 * La meta que se guarda: la del navegador, con las marcas del servidor tal como estaban en la base
 * (o las que se indiquen en `serverOwned`).
 */
export function mergeServerOwnedMeta(
  clientMeta: unknown,
  storedMeta: unknown,
  serverOwned?: Partial<Record<(typeof TEMPLATE_V2_SERVER_OWNED_META_KEYS)[number], unknown>>
): Record<string, unknown> {
  const out = withoutServerOwnedMeta(clientMeta);
  const stored = asRecord(storedMeta) ?? {};
  for (const key of TEMPLATE_V2_SERVER_OWNED_META_KEYS) {
    const value = serverOwned && key in serverOwned ? serverOwned[key] : stored[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

/** Aplica dos mapas seguidos: `a` (v1 → v2) y después `b` (v2 → v3) da v1 → v3. */
export function composeBlockIdMaps(
  a: Record<string, string>,
  b: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [from, mid] of Object.entries(a)) {
    const to = b[mid];
    if (to) out[from] = to;
  }
  return out;
}

export type VersionLineageNode = { id: string; metaJson: unknown };

/**
 * El mapa de ids de bloques desde `fromVersionId` hasta `toVersionId`, subiendo desde la de
 * destino por sus orígenes. Null si la de origen no es antecesora de la de destino.
 *
 * `loadVersion` trae una versión por id (de la misma plantilla). Se corta a los 200 saltos.
 */
export async function resolveBlockIdMapBetweenVersions(
  fromVersionId: string,
  toVersionId: string,
  loadVersion: (id: string) => Promise<VersionLineageNode | null>
): Promise<Record<string, string> | null> {
  if (fromVersionId === toVersionId) return null;
  const chain: Record<string, string>[] = [];
  const seen = new Set<string>();
  let currentId = toVersionId;
  for (let hop = 0; hop < 200; hop++) {
    if (seen.has(currentId)) return null;
    seen.add(currentId);
    const node = await loadVersion(currentId);
    if (!node) return null;
    const origin = readVersionOrigin(node.metaJson);
    if (!origin) return null;
    chain.unshift(origin.blockIdMap);
    if (origin.versionId === fromVersionId) {
      return chain.reduce((acc, map) => composeBlockIdMaps(acc, map));
    }
    currentId = origin.versionId;
  }
  return null;
}

/** Cambia ids de bloque según `map`; los que no figuran quedan igual. */
export function remapBlockId(id: string, map: Readonly<Record<string, string>>): string {
  return map[id] ?? id;
}
