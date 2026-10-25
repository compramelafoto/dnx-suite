import { CLAVES_CARGA, parte, type ParteCarga, type Progreso } from "./catalogo";
import { sumarDecision, sumarError, type Informe } from "./informe";
import type { ActorCarga, RepoCarga } from "./repositorio";
import { PREFIJO_SIMULADO, esSimulado, type Crudo, type Decision, type EntradaMapa, type FilaMapa, type ModoCarga } from "./tipos";

/**
 * El motor de 8B-1: recorre las partes elegidas en orden y, de cada fuente cruda, lotes de registros ordenados por
 * id de Alboom. Cada registro se traduce (función pura) y:
 * - en una SIMULACIÓN, sólo se cuenta en el informe (nada se escribe: ni registros ni mapa);
 * - en una CARGA, se aplica: `repo.escribir` crea o actualiza y escribe el mapa en la misma transacción, o
 *   `repo.guardarMapa` si sólo hay que atar el id de Alboom a algo que ya existe.
 * Un error en un registro no frena la parte: queda en el informe y sigue. El cursor se guarda después de cada
 * lote, así una tanda cortada por tiempo retoma donde quedó.
 */

export const LOTE = 100;
/** Margen para que el último lote (y su guardado) entren en el presupuesto. */
export const MARGEN_MS = 30_000;

export type OpcionesMotor = {
  repo: RepoCarga;
  workspaceId: string;
  modo: ModoCarga;
  entidades: readonly string[];
  informe: Informe;
  progreso: Progreso;
  actor: ActorCarga;
  ahora: () => number;
  limite: number;
  /** Devuelve `false` si la carga ya no está corriendo (la cancelaron). */
  guardar: (informe: Informe, progreso: Progreso) => Promise<boolean>;
  lote?: number;
  margenMs?: number;
};

export type ResultadoMotor = "COMPLETA" | "PAUSADA" | "CANCELADA";

/** Motivo legible de un error de un registro: sólo el tipo, nunca el mensaje (puede traer datos). */
export function motivoDeError(e: unknown): string {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  if (typeof code === "string" && /^P\d{4}$/.test(code)) return `Error de la base (${code})`;
  return "Error inesperado al traducir o guardar";
}

/** Filas del mapa de una decisión (vacío si no hay nada que atar). */
export function filasDelMapa(p: ParteCarga, c: Crudo, d: Decision, mapa: EntradaMapa | undefined): FilaMapa[] {
  if (d.escribirMapa === false) return [];
  if (d.accion === "OMITIR" && !d.targetId) return [];
  const fieldHashes = d.huellas ?? mapa?.fieldHashes ?? {};
  const propia: FilaMapa = { entity: c.entity, alboomId: c.alboomId, targetType: p.targetType, payloadHash: c.hash, fieldHashes, ...(d.targetId ? { targetId: d.targetId } : {}) };
  const otras: FilaMapa[] = (d.otrasClaves ?? []).map((o) => ({ ...o, targetType: p.targetType, payloadHash: c.hash, fieldHashes: {}, ...(d.targetId ? { targetId: d.targetId } : {}) }));
  return [propia, ...otras];
}

async function aplicar(o: OpcionesMotor, p: ParteCarga, c: Crudo, d: Decision, mapa: EntradaMapa | undefined): Promise<string | undefined> {
  const filas = filasDelMapa(p, c, d, mapa);
  if (d.accion === "CREAR" || d.accion === "ACTUALIZAR") return o.repo.escribir(o.workspaceId, p.clave, d, filas, o.actor);
  if (filas.length > 0 && d.targetId && !esSimulado(d.targetId)) {
    // Nada cambió en el registro, pero no hace falta reescribir el mapa si ya dice lo mismo.
    const igual = mapa && mapa.targetId === d.targetId && mapa.payloadHash === c.hash && !d.otrasClaves?.length;
    if (!igual) await o.repo.guardarMapa(o.workspaceId, filas.map((f) => ({ ...f, targetId: d.targetId! })));
  }
  return d.targetId;
}

function mapaDe(ctx: unknown, c: Crudo): EntradaMapa | undefined {
  const m = (ctx as { mapa?: Map<string, EntradaMapa> }).mapa;
  return m?.get(c.alboomId) ?? m?.get(`${c.entity}/${c.alboomId}`);
}

function sincronizarVistos(ctx: unknown, progreso: Progreso) {
  const v = (ctx as { vistos?: unknown }).vistos;
  if (v instanceof Map) progreso.vistos = Object.fromEntries(v) as Progreso["vistos"];
}

export async function ejecutarMotor(o: OpcionesMotor): Promise<ResultadoMotor> {
  const tamano = o.lote ?? LOTE;
  const margen = o.margenMs ?? MARGEN_MS;
  const partes = o.entidades.filter((e) => CLAVES_CARGA.includes(e)).map((e) => parte(e)!);
  const { informe, progreso } = o;

  while (progreso.indice < partes.length) {
    const p = partes[progreso.indice]!;
    if (o.ahora() + margen > o.limite) return "PAUSADA";
    const ctx = await p.contexto(o.repo, o.workspaceId, progreso);

    while (progreso.fuente < p.fuentes.length) {
      if (o.ahora() + margen > o.limite) return "PAUSADA";
      const fuente = p.fuentes[progreso.fuente]!;
      const crudos = await o.repo.leerCrudos(o.workspaceId, fuente, progreso.cursor, tamano);
      if (crudos.length === 0) {
        progreso.fuente++;
        progreso.cursor = null;
        continue;
      }
      for (const c of crudos) {
        try {
          const d = p.traducir(c, ctx);
          let targetId = d.targetId;
          if (o.modo === "CARGA") targetId = await aplicar(o, p, c, d, mapaDe(ctx, c));
          else if (d.accion === "CREAR") targetId = `${PREFIJO_SIMULADO}${c.entity}/${c.alboomId}`;
          if (targetId) {
            p.registrar?.(ctx, c, d, targetId);
            if (o.modo === "SIMULACION" && p.exporta && d.accion !== "OMITIR") {
              (progreso.simulados[c.entity] ??= {})[c.alboomId] = targetId;
              // Las filas extra del mapa (p. ej. la posición de una etapa) también, para las partes que dependen.
              for (const x of d.otrasClaves ?? []) (progreso.simulados[x.entity] ??= {})[x.alboomId] = targetId;
            }
          }
          sumarDecision(informe, p.clave, c.alboomId, d);
        } catch (e) {
          sumarError(informe, p.clave, c.alboomId, motivoDeError(e));
        }
        progreso.cursor = c.alboomId;
      }
      sincronizarVistos(ctx, progreso);
      if (!(await o.guardar(informe, progreso))) return "CANCELADA";
    }
    progreso.indice++;
    progreso.fuente = 0;
    progreso.cursor = null;
    if (!(await o.guardar(informe, progreso))) return "CANCELADA";
  }
  return "COMPLETA";
}
