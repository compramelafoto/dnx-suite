import "server-only";
import { sanitizeError } from "@/lib/payments/connect/log";
import type { Avance } from "./avance";
import { almacenPrisma } from "./almacen";
import { AlboomApiError, AlboomLoginError, crearClienteAlboom, type ClienteAlboom, type OpcionesCliente } from "./client";
import { leerCredencialAlboom, marcarAlboomParaReconectar, marcarAlboomUsada } from "./credenciales";
import { ejecutarTanda, type Almacen } from "./extractor";
import {
  avancesAnteriores,
  extraccionesParaCorrer,
  guardarAvance,
  leerAvanceDe,
  reclamarExtraccion,
  soltarCancelada,
  soltarExtraccion,
  terminarExtraccion,
} from "./extracciones";

/**
 * Una tanda del cron `/api/cron/alboom-extraccion` (cada 5 minutos, `maxDuration` 300): toma las extracciones
 * activas de a una, con un presupuesto total de 270 s, y avanza cada una con su propio cliente (un pedido por
 * segundo por workspace). Lo que no entra queda para la próxima tanda.
 */

export const PRESUPUESTO_MS = 270_000;
/** Turno de una extracción: más que una tanda entera, así una tanda muerta a mitad no la traba para siempre. */
const TURNO_MS = 6 * 60_000;
/** Lo mínimo que tiene que quedar para que valga la pena arrancar con otra extracción. */
const MINIMO_PARA_ARRANCAR_MS = 40_000;
/** Fallas transitorias seguidas (429, 5xx, red) antes de dar la extracción por fallida. */
export const MAX_REINTENTOS = 8;

const CONEXION_INACTIVA = "La conexión con Alboom no está activa: conectala de nuevo y volvé a extraer.";
const CREDENCIAL_RECHAZADA = "Alboom rechazó el usuario o la contraseña: hay que volver a conectar la cuenta.";

export type DepsCorrida = {
  ahora?: () => number;
  presupuestoMs?: number;
  opcionesCliente?: OpcionesCliente;
  almacen?: Almacen;
};

export type ResultadoCorrida = { extraccionId: string; workspaceId: string; resultado: string };

/** Espera exponencial: 1, 2, 4… minutos, hasta una hora. */
export function esperaDeReintento(reintentos: number): number {
  return Math.min(60, 2 ** Math.max(0, reintentos - 1)) * 60_000;
}

export async function correrExtraccionesAlboom(deps: DepsCorrida = {}): Promise<ResultadoCorrida[]> {
  const ahora = deps.ahora ?? (() => Date.now());
  const limite = ahora() + (deps.presupuestoMs ?? PRESUPUESTO_MS);
  const almacen = deps.almacen ?? almacenPrisma;
  const resultados: ResultadoCorrida[] = [];

  const candidatas = await extraccionesParaCorrer(new Date(ahora()));
  for (const c of candidatas) {
    if (ahora() + MINIMO_PARA_ARRANCAR_MS > limite) break;
    const anotar = (resultado: string) => resultados.push({ extraccionId: c.id, workspaceId: c.workspaceId, resultado });
    if (!(await reclamarExtraccion(c.id, c.workspaceId, new Date(ahora()), TURNO_MS))) continue;

    let avance: Avance | null = null;
    let cliente: ClienteAlboom | null = null;
    const reintentar = async (motivo: string) => {
      const a = avance!;
      a.reintentos++;
      if (a.reintentos > MAX_REINTENTOS) {
        await terminarExtraccion(c.id, c.workspaceId, "ERROR", a, `Alboom no respondió después de varios intentos. ${motivo}`, new Date(ahora()));
        anotar("ERROR");
        return;
      }
      a.reintentarDesde = new Date(ahora() + esperaDeReintento(a.reintentos)).toISOString();
      await soltarExtraccion(c.id, c.workspaceId, a);
      anotar("REINTENTAR");
    };

    try {
      avance = await leerAvanceDe(c.id, c.workspaceId);
      if (!avance) continue;
      if (avance.reintentarDesde && Date.parse(avance.reintentarDesde) > ahora()) {
        await soltarExtraccion(c.id, c.workspaceId, avance);
        anotar("ESPERANDO");
        continue;
      }

      const cred = await leerCredencialAlboom(c.workspaceId);
      if (!cred) {
        await terminarExtraccion(c.id, c.workspaceId, "ERROR", avance, CONEXION_INACTIVA, new Date(ahora()));
        anotar("ERROR");
        continue;
      }
      try {
        cliente = await crearClienteAlboom(cred, { ...deps.opcionesCliente, ahora: deps.opcionesCliente?.ahora ?? ahora });
      } catch (error) {
        if (error instanceof AlboomLoginError) {
          await marcarAlboomParaReconectar(c.workspaceId);
          await terminarExtraccion(c.id, c.workspaceId, "ERROR", avance, CREDENCIAL_RECHAZADA, new Date(ahora()));
          anotar("CREDENCIAL");
          continue;
        }
        if (error instanceof AlboomApiError && error.transitorio) {
          await reintentar(error.message);
          continue;
        }
        await terminarExtraccion(c.id, c.workspaceId, "ERROR", avance, error instanceof AlboomApiError ? error.message : "No se pudo iniciar sesión en Alboom.", new Date(ahora()));
        anotar("ERROR");
        continue;
      }

      // "Volver a extraer" pide los hijos sólo de los padres que cambiaron: necesita lo que hicieron las anteriores.
      const anteriores = c.mode === "INCREMENTAL" ? await avancesAnteriores(c.id, c.workspaceId) : [];
      const r = await ejecutarTanda({
        workspaceId: c.workspaceId,
        cliente,
        almacen,
        avance,
        ahora,
        limite,
        modo: c.mode,
        anteriores,
        guardar: (a) => guardarAvance(c.id, c.workspaceId, a),
      });
      avance = r.avance;
      switch (r.resultado) {
        case "COMPLETA":
          await terminarExtraccion(c.id, c.workspaceId, "LISTA", avance, null, new Date(ahora()));
          break;
        case "PAUSADA":
          await soltarExtraccion(c.id, c.workspaceId, avance);
          break;
        case "CANCELADA":
          await soltarCancelada(c.id, c.workspaceId);
          break;
        case "CREDENCIAL":
          await marcarAlboomParaReconectar(c.workspaceId);
          await terminarExtraccion(c.id, c.workspaceId, "ERROR", avance, CREDENCIAL_RECHAZADA, new Date(ahora()));
          break;
        case "REINTENTAR":
          await reintentar(r.motivo ?? "");
          break;
      }
      if (r.resultado !== "REINTENTAR") anotar(r.resultado);
      await marcarAlboomUsada(c.workspaceId);
    } catch (error) {
      // Algo inesperado (la base, por ejemplo): cuenta como falla transitoria y se reintenta en la próxima tanda;
      // tras varias seguidas, la extracción falla.
      console.error("[fotoffice][alboom] falló una tanda", { workspaceId: c.workspaceId, extraccionId: c.id, detalle: sanitizeError(error) });
      if (avance) await reintentar("Error inesperado.").catch(() => undefined);
    } finally {
      if (avance) {
        // Sólo cantidades: cuántos pedidos y cuántas dudas por entidad. Nunca datos de Alboom.
        const dudas = Object.fromEntries(Object.entries(avance.entidades).filter(([, e]) => e.dudas > 0).map(([k, e]) => [k, e.dudas]));
        console.info("[fotoffice][alboom] tanda", {
          workspaceId: c.workspaceId,
          extraccionId: c.id,
          pedidos: cliente?.pedidosHechos() ?? 0,
          dudas,
        });
      }
    }
  }
  return resultados;
}
