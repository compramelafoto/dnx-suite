import { conDependencias, fuentesDe, leerProgreso, progresoInicial, type Progreso } from "./catalogo";
import { ejecutarMotor } from "./motor";
import { leerInforme, informeVacio, type Informe } from "./informe";
import type { FilaCarga, RepoCarga } from "./repositorio";
import type { EstadoCarga, ModoCarga } from "./tipos";

/**
 * Ciclo de vida de una simulación o carga (`FotofficeAlboomCarga`) y la tanda del cron. Recibe el repositorio:
 * la versión de servidor (`servidor.ts`) le pasa el de Prisma; las pruebas, el de memoria.
 *
 * Reglas:
 * - una sola activa (PENDIENTE o CORRIENDO) por workspace, y nunca con una extracción en curso;
 * - la simulación guarda la huella de los datos crudos que leyó;
 * - "Cargar" sólo se habilita con una simulación LISTA, posterior a la última carga, y cuyos datos crudos no
 *   cambiaron (misma huella ahora). Carga exactamente lo que se simuló.
 */

export type VistaCarga = {
  id: string;
  mode: ModoCarga;
  status: EstadoCarga;
  entities: string[];
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
  errorReason: string | null;
  informe: Informe;
  /** Partes terminadas / total. */
  avance: { hechas: number; total: number };
};

export function vista(f: FilaCarga): VistaCarga {
  const p = leerProgreso(f.progress);
  return {
    id: f.id,
    mode: f.mode,
    status: f.status,
    entities: f.entities,
    startedAt: f.startedAt,
    finishedAt: f.finishedAt,
    updatedAt: f.updatedAt,
    errorReason: f.errorReason,
    informe: leerInforme(f.report),
    avance: { hechas: f.status === "LISTA" ? f.entities.length : Math.min(p.indice, f.entities.length), total: f.entities.length },
  };
}

export const MENSAJES_CARGA = {
  activa: "Ya hay una simulación o carga en curso.",
  extraccion: "Hay una extracción de Alboom en curso: esperá a que termine.",
  sinDatos: "Todavía no hay datos extraídos de Alboom para cargar.",
  sinSimulacion: "Primero simulá: la carga sólo se habilita con una simulación terminada.",
  simulacionVieja: "Después de esa simulación hubo una carga: simulá de nuevo.",
  datosCambiaron: "Los datos extraídos de Alboom cambiaron desde la simulación: simulá de nuevo.",
  cambiaronDurante: "Los datos extraídos de Alboom cambiaron mientras se simulaba: simulá de nuevo.",
  cambiaronDuranteCarga: "Los datos extraídos de Alboom cambiaron durante la carga: simulá y cargá de nuevo (no duplica).",
} as const;

type Inicio = { ok: true; id: string } | { ok: false; error: string };

async function sePuedeEmpezar(repo: RepoCarga, ws: string): Promise<string | null> {
  if (await repo.cargaActiva(ws)) return MENSAJES_CARGA.activa;
  if (await repo.hayExtraccionActiva(ws)) return MENSAJES_CARGA.extraccion;
  return null;
}

export async function iniciarSimulacion(repo: RepoCarga, ws: string, userId: number, elegidas: readonly string[]): Promise<Inicio> {
  const error = await sePuedeEmpezar(repo, ws);
  if (error) return { ok: false, error };
  const entities = conDependencias(elegidas);
  const { huella, cantidad } = await repo.huellaCrudos(ws, fuentesDe(entities));
  if (cantidad === 0) return { ok: false, error: MENSAJES_CARGA.sinDatos };
  const r = await repo.crearCarga({ workspaceId: ws, mode: "SIMULACION", entities, fingerprint: huella, startedByUserId: userId, progress: progresoInicial() });
  return r.ok ? r : { ok: false, error: MENSAJES_CARGA.activa };
}

/** ¿Se puede cargar ahora? Devuelve la simulación que lo habilita o el motivo. */
export async function simulacionVigente(repo: RepoCarga, ws: string): Promise<{ ok: true; simulacion: FilaCarga } | { ok: false; error: string }> {
  const sim = await repo.ultimaCarga(ws, "SIMULACION");
  if (!sim || sim.status !== "LISTA" || !sim.fingerprint) return { ok: false, error: MENSAJES_CARGA.sinSimulacion };
  const carga = await repo.ultimaCarga(ws, "CARGA");
  if (carga && carga.startedAt.getTime() > sim.startedAt.getTime()) return { ok: false, error: MENSAJES_CARGA.simulacionVieja };
  const { huella } = await repo.huellaCrudos(ws, fuentesDe(sim.entities));
  if (huella !== sim.fingerprint) return { ok: false, error: MENSAJES_CARGA.datosCambiaron };
  return { ok: true, simulacion: sim };
}

export async function iniciarCarga(repo: RepoCarga, ws: string, userId: number): Promise<Inicio> {
  const error = await sePuedeEmpezar(repo, ws);
  if (error) return { ok: false, error };
  const v = await simulacionVigente(repo, ws);
  if (!v.ok) return v;
  const sim = v.simulacion;
  const r = await repo.crearCarga({
    workspaceId: ws,
    mode: "CARGA",
    entities: sim.entities,
    fingerprint: sim.fingerprint!,
    startedByUserId: userId,
    progress: progresoInicial({ simulacionId: sim.id }),
  });
  return r.ok ? r : { ok: false, error: MENSAJES_CARGA.activa };
}

export async function cancelarCarga(repo: RepoCarga, ws: string, ahora = new Date()): Promise<boolean> {
  return repo.cancelar(ws, ahora);
}

/** Para la pantalla: la activa (si hay), la última simulación, la última carga y si "Cargar" está habilitado. */
export async function estadoCargas(repo: RepoCarga, ws: string) {
  const [activa, simulacion, carga] = await Promise.all([repo.cargaActiva(ws), repo.ultimaCarga(ws, "SIMULACION"), repo.ultimaCarga(ws, "CARGA")]);
  const habilitada = activa ? ({ ok: false, error: MENSAJES_CARGA.activa } as const) : await simulacionVigente(repo, ws);
  return {
    activa: activa ? vista(activa) : null,
    simulacion: simulacion ? vista(simulacion) : null,
    carga: carga ? vista(carga) : null,
    cargaHabilitada: habilitada.ok ? ({ ok: true } as const) : ({ ok: false, error: habilitada.error } as const),
  };
}

// ── Tanda del cron ───────────────────────────────────────────────────────────

export const PRESUPUESTO_MS = 270_000;
/** Más que una tanda entera: una tanda muerta a mitad no traba la carga para siempre. */
export const TURNO_MS = 6 * 60_000;
const MINIMO_PARA_ARRANCAR_MS = 40_000;
/** Fallas inesperadas seguidas (la base, por ejemplo) antes de dar la carga por fallida. */
export const MAX_REINTENTOS = 5;

export type DepsCorrida = { ahora?: () => number; presupuestoMs?: number; lote?: number; margenMs?: number };
export type ResultadoCorrida = { cargaId: string; workspaceId: string; resultado: string };

export const ETIQUETA_ACTOR = "Migración desde Alboom";

export async function correrCargas(repo: RepoCarga, deps: DepsCorrida = {}): Promise<ResultadoCorrida[]> {
  const ahora = deps.ahora ?? (() => Date.now());
  const limite = ahora() + (deps.presupuestoMs ?? PRESUPUESTO_MS);
  const resultados: ResultadoCorrida[] = [];

  for (const c of await repo.cargasParaCorrer(new Date(ahora()), 20)) {
    if (ahora() + MINIMO_PARA_ARRANCAR_MS > limite) break;
    const anotar = (resultado: string) => resultados.push({ cargaId: c.id, workspaceId: c.workspaceId, resultado });
    if (!(await repo.reclamar(c.id, c.workspaceId, new Date(ahora()), TURNO_MS))) continue;
    const fila = await repo.leerCarga(c.id, c.workspaceId);
    if (!fila) continue;
    const informe = fila.report ? leerInforme(fila.report) : informeVacio();
    const progreso: Progreso = { ...leerProgreso(fila.progress), reintentos: 0 };
    try {
      const r = await ejecutarMotor({
        repo,
        workspaceId: c.workspaceId,
        modo: fila.mode,
        entidades: fila.entities,
        informe,
        progreso,
        actor: { userId: fila.startedByUserId, label: ETIQUETA_ACTOR },
        ahora,
        limite,
        lote: deps.lote,
        margenMs: deps.margenMs,
        guardar: (i, p) => repo.guardarAvance(c.id, c.workspaceId, i, p),
      });
      if (r === "COMPLETA") {
        let error: string | null = null;
        // Los crudos tienen que seguir iguales a los simulados también al terminar una carga (la exclusión con la
        // extracción es "leer y después crear", sin bloqueo común).
        const { huella } = await repo.huellaCrudos(c.workspaceId, fuentesDe(fila.entities));
        if (huella !== fila.fingerprint) error = fila.mode === "SIMULACION" ? MENSAJES_CARGA.cambiaronDurante : MENSAJES_CARGA.cambiaronDuranteCarga;
        await repo.terminar(c.id, c.workspaceId, error ? "ERROR" : "LISTA", informe, progreso, error, new Date(ahora()));
        anotar(error ? "ERROR" : "LISTA");
      } else if (r === "PAUSADA") {
        await repo.soltar(c.id, c.workspaceId, informe, progreso);
        anotar("PAUSADA");
      } else {
        await repo.soltarCancelada(c.id, c.workspaceId);
        anotar("CANCELADA");
      }
    } catch (error) {
      // Algo inesperado fuera de un registro (leer el contexto, guardar el avance): se reintenta en la próxima
      // tanda desde el último avance guardado; tras varias seguidas, la carga falla. Nunca se loguea el detalle.
      const ultima = (await repo.leerCarga(c.id, c.workspaceId).catch(() => null)) ?? fila;
      const guardado = leerProgreso(ultima.progress);
      guardado.reintentos = leerProgreso(fila.progress).reintentos + 1;
      const tipo = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
      console.error("[fotoffice][alboom-carga] falló una tanda", { workspaceId: c.workspaceId, cargaId: c.id, codigo: typeof tipo === "string" ? tipo : "desconocido" });
      if (guardado.reintentos > MAX_REINTENTOS) {
        await repo.terminar(c.id, c.workspaceId, "ERROR", ultima.report, guardado, "Falló varias veces seguidas. Probá de nuevo más tarde.", new Date(ahora())).catch(() => undefined);
        anotar("ERROR");
      } else {
        await repo.soltar(c.id, c.workspaceId, ultima.report, guardado).catch(() => undefined);
        anotar("REINTENTAR");
      }
    }
  }
  return resultados;
}
