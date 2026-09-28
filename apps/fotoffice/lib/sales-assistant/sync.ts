import "server-only";
import {
  AlboomApiError,
  AlboomLoginError,
  crearClienteAlboom,
  type ClienteAlboom,
} from "./alboom/client";
import { leerCredencialAlboom, marcarCredencialRechazada } from "./alboom/credentials";
import { fechaAlboom, mapearOportunidad, movimientosDesde } from "./alboom/mapper";
import type { AlboomLeadRow } from "./alboom/types";
import { analizarOportunidad, iaDisponible } from "./analyzer";
import { ANALISIS_EN_PARALELO, MAX_ANALISIS_POR_CORRIDA, type EstadoSync } from "./constants";
import { necesitaAnalisis } from "./needs-analysis";
import type { Movimiento, OportunidadVenta } from "./opportunity";
import { armarContexto } from "./prompt";
import * as repository from "./repository";

/**
 * El orquestador diario: lee Alboom, guarda lo que trajo y decide qué le pasa a Claude.
 *
 * Es la única función del módulo que toca red y base a la vez; todo lo demás (mapper,
 * needs-analysis, prompt, analyzer, repository) es reemplazable por inyección para poder
 * probar el algoritmo entero con un repo en memoria, sin Prisma ni fetch real.
 *
 * `repo` sólo declara lo que `sincronizarWorkspace` usa (no el repositorio completo): así el
 * fake del test es un objeto chico, en vez de tener que simular las quince consultas de
 * `repository.ts`.
 */
export type RepoSync = Pick<
  typeof repository,
  | "leerAjustes"
  | "registrarSync"
  | "oportunidadGuardada"
  | "guardarOportunidad"
  | "marcarNoVistasComoCerradas"
  | "contextoDeAnalisis"
  | "guardarSugerencia"
>;

export type DependenciasSync = {
  leerCredencial: typeof leerCredencialAlboom;
  crearCliente: typeof crearClienteAlboom;
  repo: RepoSync;
  analizar: typeof analizarOportunidad;
  iaDisponible: typeof iaDisponible;
  ahora: () => Date;
  marcarCredencialRechazada: typeof marcarCredencialRechazada;
};

export type ResumenSync = {
  estado: EstadoSync;
  leidas: number;
  analizadas: number;
  fallidas: number;
  pendientes: number;
  mensaje: string | null;
};

/**
 * Las dependencias reales, armadas recién cuando se llaman. Es una función (no una constante de
 * módulo) para que `import { sincronizarWorkspace } from "./sync"` en el test no obligue a nada
 * más que a construir estos objetos; ningún efecto ocurre hasta que `sincronizarWorkspace` los usa.
 */
function depsReales(): DependenciasSync {
  return {
    leerCredencial: leerCredencialAlboom,
    marcarCredencialRechazada,
    crearCliente: crearClienteAlboom,
    repo: repository,
    analizar: analizarOportunidad,
    iaDisponible,
    ahora: () => new Date(),
  };
}

/** Una oportunidad ya guardada en esta corrida, lista para decidir si se analiza. */
type OportunidadProcesada = {
  /** Id interno (de FOTOFFICE), no el id de Alboom. */
  id: string;
  idExterno: string;
  op: OportunidadVenta;
  archivada: boolean;
};

const SIN_MOVIMIENTOS: Movimiento[] = [];

export async function sincronizarWorkspace(
  workspaceId: string,
  opciones?: { forzarIds?: string[]; deps?: Partial<DependenciasSync>; deadlineMs?: number },
): Promise<ResumenSync> {
  const d: DependenciasSync = { ...depsReales(), ...opciones?.deps };
  const forzarIds = new Set(opciones?.forzarIds ?? []);
  const deadlineMs = opciones?.deadlineMs ?? 240_000;

  const vacio = (estado: EstadoSync, mensaje: string | null): ResumenSync => ({
    estado,
    leidas: 0,
    analizadas: 0,
    fallidas: 0,
    pendientes: 0,
    mensaje,
  });

  const cred = await d.leerCredencial(workspaceId);
  if (!cred) return vacio("ERROR_LOGIN", "Falta conectar Alboom");

  const ajustes = await d.repo.leerAjustes(workspaceId);

  let cliente: ClienteAlboom;
  let filas: AlboomLeadRow[];
  try {
    cliente = await d.crearCliente(cred);
    filas = await cliente.listarAbiertas();
  } catch (error) {
    if (error instanceof AlboomLoginError) {
      await d.marcarCredencialRechazada(workspaceId);
      const mensaje = "Alboom rechazó la conexión";
      await d.repo.registrarSync(workspaceId, "ERROR_LOGIN", mensaje);
      return vacio("ERROR_LOGIN", mensaje);
    }
    if (error instanceof AlboomApiError) {
      const mensaje = "No se pudo leer Alboom";
      await d.repo.registrarSync(workspaceId, "ERROR_ALBOOM", mensaje);
      return vacio("ERROR_ALBOOM", mensaje);
    }
    throw error;
  }

  // Sin embudos elegidos, "incluir todos" sería peor que no sincronizar: el fotógrafo vería
  // mezclado lo que quiere vender con presupuestos viejos o descartados de otros rubros.
  if (ajustes.pipelinesIncluded.length === 0) {
    const mensaje = "Elegí qué embudos incluir en Configuración";
    await d.repo.registrarSync(workspaceId, "OK", mensaje);
    return vacio("OK", mensaje);
  }

  const pipelinesIncluidos = new Set(ajustes.pipelinesIncluded);
  const incluidas = filas.filter((fila) => pipelinesIncluidos.has((fila.pipeline_name ?? "").trim()));

  const ahora = d.ahora();
  const procesadas: OportunidadProcesada[] = [];
  let fallidas = 0;

  for (const fila of incluidas) {
    const idExterno = String(fila.id);
    const existente = await d.repo.oportunidadGuardada(workspaceId, "ALBOOM", idExterno);
    const modificadaFila = fechaAlboom(fila.modified);
    // Sin fila previa, o con una fecha de Alboom más nueva que la guardada, hay que releer el
    // detalle. Si la fecha no se pudo interpretar, se pide igual: es la opción segura.
    const necesitaDetalle =
      !existente || modificadaFila === null || modificadaFila.getTime() > existente.modificadaEn.getTime();

    let movimientos: Movimiento[];
    if (necesitaDetalle) {
      try {
        movimientos = movimientosDesde(await cliente.detalle(idExterno));
      } catch (error) {
        if (!(error instanceof AlboomApiError)) throw error;
        // Un detalle que no se pudo leer no tira abajo la corrida: se guarda con el snapshot
        // anterior (o vacío, si es la primera vez) y queda contado como PARCIAL.
        movimientos = existente?.snapshot.movimientos ?? SIN_MOVIMIENTOS;
        fallidas++;
      }
    } else {
      movimientos = existente.snapshot.movimientos;
    }

    const op = mapearOportunidad(fila, movimientos);
    const guardada = await d.repo.guardarOportunidad(workspaceId, op, ahora);
    procesadas.push({ id: guardada.id, idExterno: op.idExterno, op, archivada: guardada.archivada });
  }

  // Se pasan TODOS los ids abiertos que devolvió Alboom, de cualquier embudo: si sólo mandara
  // los incluidos, una oportunidad de un embudo excluido (que nunca se guarda) quedaría marcada
  // CERRADA por error la primera vez que alguien la mire.
  await d.repo.marcarNoVistasComoCerradas(
    workspaceId,
    filas.map((fila) => String(fila.id)),
    ahora,
  );

  let analizadas = 0;
  let pendientes = 0;

  if (d.iaDisponible()) {
    const candidatas: Array<{
      procesada: OportunidadProcesada;
      contexto: Awaited<ReturnType<RepoSync["contextoDeAnalisis"]>>;
    }> = [];
    for (const procesada of procesadas) {
      const contexto = await d.repo.contextoDeAnalisis(workspaceId, procesada.id);
      const decision = necesitaAnalisis({
        oportunidad: procesada.op,
        ultima: contexto.ultima,
        ultimoSeguimientoEn: contexto.ultimoSeguimientoEn,
        archivada: procesada.archivada,
        forzar: forzarIds.has(procesada.idExterno),
        hoy: ahora,
        waitDays: ajustes.waitDays,
      });
      if (decision.analizar) candidatas.push({ procesada, contexto });
    }

    const aProcesar = candidatas.slice(0, MAX_ANALISIS_POR_CORRIDA);
    pendientes = candidatas.length - aProcesar.length;

    const inicio = d.ahora().getTime();
    let siguiente = 0;
    const trabajador = async (): Promise<void> => {
      while (siguiente < aProcesar.length) {
        if (d.ahora().getTime() - inicio > deadlineMs) return;
        const item = aProcesar[siguiente++]!;
        const contextoTexto = armarContexto({
          oportunidad: item.procesada.op,
          seguimientos: item.contexto.seguimientos,
          sugerenciasPrevias: item.contexto.sugerenciasPrevias,
          voz: { firma: ajustes.signature, indicaciones: ajustes.voiceNotes },
          hoy: ahora,
        });
        const resultado = await d.analizar(contextoTexto);
        await d.repo.guardarSugerencia(workspaceId, item.procesada.id, resultado, item.procesada.op.modificadaEn, ahora);
        analizadas++;
        if (resultado.fallo) fallidas++;
      }
    };
    // Un pool sencillo: N corutinas comparten el mismo índice y cortan si se acabó el tiempo.
    // Las que ya estaban a mitad de un análisis terminan igual; sólo se frena tomar una nueva.
    await Promise.all(Array.from({ length: Math.min(ANALISIS_EN_PARALELO, aProcesar.length) }, trabajador));
    pendientes += aProcesar.length - analizadas;
  }

  const estado: EstadoSync = pendientes > 0 || fallidas > 0 ? "PARCIAL" : "OK";
  const mensaje = `Leí ${incluidas.length} oportunidades y analicé ${analizadas}`;
  await d.repo.registrarSync(workspaceId, estado, mensaje);

  return { estado, leidas: incluidas.length, analizadas, fallidas, pendientes, mensaje };
}
