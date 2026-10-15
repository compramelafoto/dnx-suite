import { MOTIVOS, porMapa } from "../campos";
import { campos, clave, entero, idAlboom, texto } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Embudos de venta (`lead_stage`) y flujos de proyecto (`stage`) de Alboom → circuitos y etapas que DNX ya tiene
 * (sembrados en la etapa 0.4: 4 embudos + 17 flujos). En 8B-1 **sólo se emparejan** por nombre normalizado (con
 * las erratas conocidas corregidas): lo que no empareja se informa y no se crea.
 *
 * Alboom guarda la etapa de cada oportunidad/proyecto **por posición** (1..n), no por id. Por eso cada etapa
 * emparejada deja además una fila del mapa "posicion_embudo"/"posicion_flujo" con id "<idEmbudo>/<posición>":
 * la 8B-2 traduce `pipeline_id` + `stage_id` con esa fila.
 *
 * Formas (doc 01 §6.2): embudo `{ id, name }`; etapa `{ id, type_id, stage, name, offset_days, tasks }`.
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

export type CtxCircuitos = {
  circuitos: CircuitoExistente[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirCircuito(c: Crudo, ctx: CtxCircuitos): Decision {
  const clase = CLASE_DE[c.entity];
  if (!clase) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  const ya = porMapa(c, ctx.mapa.get(c.alboomId), (id) => ctx.circuitos.some((x) => x.id === id));
  if (ya) return ya;
  const nombre = texto(campos(c.payload).name, 1000);
  if (!nombre) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const k = claveNombre(nombre);
  const existente = ctx.circuitos.find((x) => x.kind === clase && claveNombre(x.name) === k);
  if (!existente) return { accion: "OMITIR", motivo: MOTIVOS.sinCircuito };
  const mapa = ctx.mapa.get(c.alboomId);
  return { accion: "IGUAL", targetId: existente.id, vincula: !mapa || mapa.targetId !== existente.id, huellas: {} };
}

export type CtxEtapas = {
  /** "<entidad del embudo/flujo>/<id de Alboom>" (p. ej. "embudos/1611") → circuito de FOTOFFICE ya emparejado. */
  circuitoDe: Map<string, string>;
  etapas: EtapaExistente[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirEtapa(c: Crudo, ctx: CtxEtapas): Decision {
  const clase = CLASE_DE[c.entity];
  if (!clase) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  const p = campos(c.payload);
  const idCircuito = idAlboom(p.type_id ?? p.pipeline_id);
  const posicion = entero(p.stage ?? p.position);
  const nombre = texto(p.name, 1000);
  if (!idCircuito || posicion === null) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  if (!nombre) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const circuitId = ctx.circuitoDe.get(`${CIRCUITO_DE_ETAPA[c.entity]}/${idCircuito}`);
  if (!circuitId) return { accion: "OMITIR", motivo: MOTIVOS.circuitoSinCargar };
  const otrasClaves = [{ entity: ENTIDAD_POSICION[clase], alboomId: `${idCircuito}/${posicion}` }];
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.etapas.some((x) => x.id === id));
  if (ya) return ya.accion === "IGUAL" ? { ...ya, otrasClaves } : ya;
  const k = claveNombre(nombre);
  const existente = ctx.etapas.find((x) => x.circuitId === circuitId && claveNombre(x.name) === k);
  if (!existente) return { accion: "OMITIR", motivo: MOTIVOS.sinEtapa };
  return { accion: "IGUAL", targetId: existente.id, vincula: !mapa || mapa.targetId !== existente.id, huellas: {}, otrasClaves };
}
