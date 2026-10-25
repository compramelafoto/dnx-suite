import { DUDAS, MOTIVOS, huellaCampo, porMapa } from "../campos";
import { campos, clave, entero, idAlboom, texto } from "../normalizar";
import { esSimulado, type Crudo, type Decision, type EntradaMapa } from "../tipos";

/**
 * Embudos de venta (`lead_stage`) y flujos de proyecto (`stage`) de Alboom → circuitos y etapas que DNX ya tiene
 * (sembrados en la etapa 0.4: 4 embudos + 17 flujos). Se emparejan por nombre normalizado (con las erratas conocidas
 * corregidas). Lo que no empareja (p. ej. el embudo 1611 "Embudo de Ventas DNX 2022" en la simulación real del
 * 25/10/2026) se CREA inactivo, con sus etapas, para que las consultas y proyectos históricos de la 8B-2 tengan
 * destino; en un circuito que ya existía nunca se crean etapas.
 *
 * Alboom guarda la etapa de cada oportunidad/proyecto **por posición** (1..n), no por id. Por eso cada etapa
 * emparejada deja además una fila del mapa "posicion_embudo"/"posicion_flujo" con id "<idEmbudo>/<posición>":
 * la 8B-2 traduce `pipeline_id` + `stage_id` con esa fila.
 *
 * Formas: embudo `{ id, name }` (a veces con `stage_count`); etapa real (DNX, 25/10/2026)
 * `{ id, name, stage, tasks, offset_days }` SIN el embudo. Desde la versión 2 del extractor la etapa trae `type_id`
 * (la clave de `stages`); para lo extraído antes, `deducirEmbudos` lo deduce por el orden de los ids.
 */

export const TIPO_CIRCUITO = "CIRCUIT";
export const TIPO_ETAPA = "STAGE";

export type Clase = "VENTA" | "TRABAJO";

/** Entidad del crudo → clase del circuito. */
export const CLASE_DE: Record<string, Clase> = {
  embudos: "VENTA",
  flujos_proyecto: "TRABAJO",
  etapas_embudo: "VENTA",
  etapas_flujo: "TRABAJO",
};

/** Entidad de las etapas → entidad de su embudo/flujo (el `type_id` de la etapa es un id de esa entidad). */
export const CIRCUITO_DE_ETAPA: Record<string, string> = { etapas_embudo: "embudos", etapas_flujo: "flujos_proyecto" };

export const ENTIDAD_POSICION: Record<Clase, string> = { VENTA: "posicion_embudo", TRABAJO: "posicion_flujo" };

/** Erratas de los nombres de Alboom (doc 09: "oportunidnad", "Eidción", "Instalr"…), ya corregidas en las semillas. */
const ERRATAS: Record<string, string> = {
  oportunidnad: "oportunidad",
  eidcion: "edicion",
  instalr: "instalar",
  revison: "revision",
};

/** Nombre normalizado para emparejar: sin mayúsculas, acentos ni signos, y con las erratas corregidas. */
export function claveNombre(nombre: string): string {
  return clave(nombre)
    .split(" ")
    .map((p) => ERRATAS[p] ?? p)
    .join(" ");
}

export type CircuitoExistente = { id: string; name: string; kind: string };
export type EtapaExistente = { id: string; circuitId: string; name: string };

/** Marca, en las huellas del mapa, de un circuito que creó la carga (sus etapas se crean; las de los otros no). */
export const CLAVE_CREADO = "_creado";
export const huellasDeCreado = () => ({ [CLAVE_CREADO]: huellaCampo(true) });
export const fueCreado = (m: EntradaMapa | undefined) => !!m && CLAVE_CREADO in m.fieldHashes;

export type CtxCircuitos = {
  circuitos: CircuitoExistente[];
  mapa: Map<string, EntradaMapa>;
};

export const MAX_NOMBRE_CIRCUITO = 120;

export function traducirCircuito(c: Crudo, ctx: CtxCircuitos): Decision {
  const clase = CLASE_DE[c.entity];
  if (!clase) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.circuitos.some((x) => x.id === id));
  if (ya) return ya.accion === "IGUAL" && fueCreado(mapa) ? { ...ya, huellas: huellasDeCreado() } : ya;
  const nombre = texto(campos(c.payload).name, 1000);
  if (!nombre) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  if (mapa && fueCreado(mapa)) return { accion: "IGUAL", targetId: mapa.targetId, huellas: huellasDeCreado() };
  const k = claveNombre(nombre);
  const existente = ctx.circuitos.find((x) => x.kind === clase && claveNombre(x.name) === k);
  if (existente) return { accion: "IGUAL", targetId: existente.id, vincula: !mapa || mapa.targetId !== existente.id, huellas: {} };
  // Sin equivalente: se crea inactivo (no aparece para elegir en el tablero) con el nombre de Alboom. El nombre es
  // único por workspace: si ya lo usa un circuito de la otra clase, se le agrega "(Alboom)".
  let name = nombre.slice(0, MAX_NOMBRE_CIRCUITO).trim();
  if (ctx.circuitos.some((x) => clave(x.name) === clave(name))) name = `${name.slice(0, MAX_NOMBRE_CIRCUITO - 9).trim()} (Alboom)`;
  return { accion: "CREAR", datos: { name, kind: clase, isActive: false }, huellas: huellasDeCreado(), dudas: [DUDAS.circuitoCreado] };
}

export function registrarCircuito(ctx: CtxCircuitos, d: Decision, targetId: string): void {
  if (d.accion === "CREAR" && d.datos) ctx.circuitos.push({ id: targetId, name: String(d.datos.name), kind: String(d.datos.kind) });
}

export type CtxEtapas = {
  /** "<entidad del embudo/flujo>/<id de Alboom>" (p. ej. "embudos/1611") → circuito de FOTOFFICE ya emparejado. */
  circuitoDe: Map<string, string>;
  /** Circuitos que creó la carga (o la simulación): sólo en ellos se crean las etapas que falten. */
  creados?: Set<string>;
  /** "<entidad de la etapa>/<id>" → id del embudo deducido para las etapas que no lo traen (`deducirEmbudos`). */
  deducido?: Map<string, string>;
  etapas: EtapaExistente[];
  mapa: Map<string, EntradaMapa>;
};

export const MAX_DIAS_ETAPA = 3650;

/**
 * Para etapas sin `type_id` (extraídas antes de la versión 2): ordenadas por id, cada vez que la posición vuelve a
 * empezar es otro embudo; los grupos se asignan a los embudos en el orden de sus ids. Sólo se acepta si hay tantos
 * grupos como embudos, cada grupo va de 1 a n sin saltos y, si el embudo dice cuántas etapas tiene (`stage_count`),
 * coincide. Si algo no cierra no se deduce nada (las etapas se omiten y se pide volver a extraer).
 */
export function deducirEmbudos(etapas: { alboomId: string; payload: unknown }[], embudos: { alboomId: string; payload: unknown }[]): Map<string, string> {
  const sin = etapas
    .map((e) => ({ id: e.alboomId, p: campos(e.payload) }))
    .filter((e) => !idAlboom(e.p.type_id ?? e.p.pipeline_id))
    .map((e) => ({ id: e.id, n: Number(e.id), pos: entero(e.p.stage ?? e.p.position) }));
  const out = new Map<string, string>();
  if (sin.length === 0 || sin.some((e) => !Number.isFinite(e.n) || e.pos === null)) return out;
  sin.sort((a, b) => a.n - b.n);
  const grupos: (typeof sin)[] = [];
  for (const e of sin) {
    const g = grupos[grupos.length - 1];
    if (!g || e.pos! <= g[g.length - 1]!.pos!) grupos.push([e]);
    else g.push(e);
  }
  const ordenados = embudos.map((e) => ({ id: e.alboomId, n: Number(e.alboomId), p: campos(e.payload) })).filter((e) => Number.isFinite(e.n)).sort((a, b) => a.n - b.n);
  if (grupos.length !== ordenados.length) return out;
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i]!;
    if (g.some((e, j) => e.pos !== j + 1)) return new Map();
    const cuenta = entero(ordenados[i]!.p.stage_count);
    if (cuenta !== null && cuenta !== g.length) return new Map();
    for (const e of g) out.set(e.id, ordenados[i]!.id);
  }
  return out;
}

export function traducirEtapa(c: Crudo, ctx: CtxEtapas): Decision {
  const clase = CLASE_DE[c.entity];
  if (!clase) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  const p = campos(c.payload);
  const propio = idAlboom(p.type_id ?? p.pipeline_id);
  const idCircuito = propio ?? ctx.deducido?.get(c.alboomId) ?? null;
  const posicion = entero(p.stage ?? p.position);
  const nombre = texto(p.name, 1000);
  if (posicion === null) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  if (!idCircuito) return { accion: "OMITIR", motivo: MOTIVOS.etapaSinEmbudo };
  if (!nombre) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const circuitId = ctx.circuitoDe.get(`${CIRCUITO_DE_ETAPA[c.entity]}/${idCircuito}`);
  if (!circuitId) return { accion: "OMITIR", motivo: MOTIVOS.circuitoSinCargar };
  const dudas = propio ? [] : [DUDAS.embudoDeducido];
  const otrasClaves = [{ entity: ENTIDAD_POSICION[clase], alboomId: `${idCircuito}/${posicion}` }];
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.etapas.some((x) => x.id === id));
  if (ya) return ya.accion === "IGUAL" ? { ...ya, otrasClaves } : ya;
  const k = claveNombre(nombre);
  const existente = ctx.etapas.find((x) => x.circuitId === circuitId && claveNombre(x.name) === k);
  const extra = dudas.length ? { dudas } : {};
  if (existente) return { accion: "IGUAL", targetId: existente.id, vincula: !mapa || mapa.targetId !== existente.id, huellas: {}, otrasClaves, ...extra };
  if (!(ctx.creados?.has(circuitId) || esSimulado(circuitId))) return { accion: "OMITIR", motivo: MOTIVOS.sinEtapa };
  const dias = entero(p.offset_days);
  return {
    accion: "CREAR",
    datos: { circuitId, name: nombre.slice(0, MAX_NOMBRE_CIRCUITO).trim(), order: posicion, days: Math.max(0, Math.min(MAX_DIAS_ETAPA, dias ?? 0)) },
    huellas: {},
    otrasClaves,
    ...extra,
  };
}

export function registrarEtapa(ctx: CtxEtapas, d: Decision, targetId: string): void {
  if (d.accion === "CREAR" && d.datos) ctx.etapas.push({ id: targetId, circuitId: String(d.datos.circuitId), name: String(d.datos.name) });
}
