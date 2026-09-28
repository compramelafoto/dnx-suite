import { describe, expect, it, vi } from "vitest";
import { AlboomApiError, AlboomLoginError, type ClienteAlboom, type CredencialAlboom } from "./alboom/client";
import type { AlboomLeadRow } from "./alboom/types";
import type { ResultadoAnalisis } from "./analyzer";
import type { AjustesVentas } from "./repository";
import type { RepoSync } from "./sync";
import { sincronizarWorkspace } from "./sync";
import type { OportunidadVenta } from "./opportunity";

/**
 * `sincronizarWorkspace` se prueba entero, de punta a punta, con dependencias falsas: un repo en
 * memoria (un `Map`), un cliente Alboom que responde lo que el test le arma y un `analizar` que
 * nunca toca la red. Nada de esto pega contra Prisma ni contra `fetch`.
 */

const CRED: CredencialAlboom = { subdomain: "foto", username: "u", password: "p" };

function filaAlboom(overrides: Partial<AlboomLeadRow> = {}): AlboomLeadRow {
  return {
    id: "1",
    name: "Casamiento",
    description: null,
    status_id: "421",
    pipeline_id: "1",
    stage_id: "1",
    created: "2026-01-01 10:00",
    modified: "2026-01-01 10:00",
    event_date: "2026-06-01",
    place_event: null,
    city_event: null,
    guests: null,
    quote_sent_date: null,
    lead_origin: null,
    customer_name: "Pilar",
    customer_lastname: "Gómez",
    customer_email: null,
    customer_phone: null,
    customer_cellular: null,
    pipeline_name: "Casamientos",
    stage_name: "Consulta",
    stages_count: "5",
    ...overrides,
  };
}

/** Un repo en memoria: alcanza con un `Map` por oportunidad y una fila de ajustes/sync. */
function repoEnMemoria(ajustesIniciales: Partial<AjustesVentas> = {}) {
  const oportunidades = new Map<string, { id: string; snapshot: OportunidadVenta; archivada: boolean }>();
  const sugerencias: { opportunityId: string; resultado: ResultadoAnalisis; creadaEn: Date; oportunidadModificadaEn: Date }[] = [];
  let siguienteId = 1;
  const registros: { estado: string; mensaje: string | null }[] = [];

  const ajustes: AjustesVentas = {
    pipelinesIncluded: ["Casamientos"],
    signature: "Fotógrafo",
    voiceNotes: null,
    waitDays: 3,
    staleDays: 120,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: null,
    ...ajustesIniciales,
  };

  const repo: RepoSync = {
    async leerAjustes() {
      return ajustes;
    },
    async registrarSync(_workspaceId, estado, mensaje) {
      registros.push({ estado, mensaje });
    },
    async oportunidadGuardada(_workspaceId, _source, externalId) {
      const fila = oportunidades.get(externalId);
      if (!fila) return null;
      return { id: fila.id, modificadaEn: fila.snapshot.modificadaEn, snapshot: fila.snapshot, archivada: fila.archivada };
    },
    async guardarOportunidad(_workspaceId, op) {
      const existente = oportunidades.get(op.idExterno);
      const id = existente?.id ?? String(siguienteId++);
      const archivada = existente?.archivada ?? false;
      oportunidades.set(op.idExterno, { id, snapshot: op, archivada });
      return { id, archivada };
    },
    async marcarNoVistasComoCerradas(_workspaceId, idsVistos) {
      for (const [externalId, fila] of oportunidades) {
        if (!idsVistos.includes(externalId)) fila.snapshot = { ...fila.snapshot, abierta: false };
      }
    },
    async contextoDeAnalisis(_workspaceId, opportunityId) {
      const previas = sugerencias.filter((s) => s.opportunityId === opportunityId);
      const ultimaGuardada = previas[previas.length - 1] ?? null;
      const ultima = ultimaGuardada
        ? {
            creadaEn: ultimaGuardada.creadaEn,
            accion: ultimaGuardada.resultado.sugerencia.accion,
            estado: "PENDIENTE" as const,
            esperarHasta: null,
            oportunidadModificadaEn: ultimaGuardada.oportunidadModificadaEn,
          }
        : null;
      return { ultima, ultimoSeguimientoEn: null, seguimientos: [], sugerenciasPrevias: [] };
    },
    async guardarSugerencia(_workspaceId, opportunityId, resultado, oportunidadModificadaEn, ahora) {
      sugerencias.push({ opportunityId, resultado, creadaEn: ahora, oportunidadModificadaEn });
    },
  };

  return { repo, oportunidades, sugerencias, registros, ajustes };
}

function clienteFalso(filas: AlboomLeadRow[], detalles: Record<string, () => Promise<{ activities: never[]; mails: never[] }>> = {}): ClienteAlboom {
  return {
    async listarAbiertas() {
      return filas;
    },
    async detalle(id) {
      const fn = detalles[id];
      if (fn) return fn();
      return { activities: [], mails: [] };
    },
    async embudos() {
      return [];
    },
  };
}

const analizarOk = vi.fn(
  async (): Promise<ResultadoAnalisis> => ({
    sugerencia: { accion: "ESCRIBIR", prioridad: "MEDIA", motivo: "m", mensaje: "hola", esperarDias: null },
    modelo: "test",
    inputTokens: 1,
    outputTokens: 1,
    fallo: false,
  }),
);

describe("sincronizarWorkspace", () => {
  it("sin credencial da ERROR_LOGIN", async () => {
    const r = await sincronizarWorkspace("w1", {
      deps: { leerCredencial: async () => null },
    });
    expect(r).toEqual({ estado: "ERROR_LOGIN", leidas: 0, analizadas: 0, fallidas: 0, pendientes: 0, mensaje: "Falta conectar Alboom" });
  });

  it("login rechazado marca la credencial y da ERROR_LOGIN", async () => {
    const { repo, registros } = repoEnMemoria();
    const marcar = vi.fn(async () => {});
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => {
          throw new AlboomLoginError("rechazado");
        },
        marcarCredencialRechazada: marcar,
        repo,
      },
    });
    expect(r.estado).toBe("ERROR_LOGIN");
    expect(marcar).toHaveBeenCalledWith("w1");
    expect(registros).toEqual([{ estado: "ERROR_LOGIN", mensaje: expect.any(String) }]);
  });

  it("Alboom caído da ERROR_ALBOOM sin tocar oportunidades", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => {
          throw new AlboomApiError("caído");
        },
        repo,
      },
    });
    expect(r.estado).toBe("ERROR_ALBOOM");
    expect(oportunidades.size).toBe(0);
  });

  it("con pipelinesIncluded vacío no analiza nada y el mensaje pide elegir embudos", async () => {
    const { repo, oportunidades } = repoEnMemoria({ pipelinesIncluded: [] });
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso([filaAlboom()]),
        repo,
      },
    });
    expect(r.estado).toBe("OK");
    expect(r.mensaje).toMatch(/embudos/i);
    expect(oportunidades.size).toBe(0);
  });

  it("una corrida normal lee 3 y analiza las 3 nuevas", async () => {
    const { repo } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" }), filaAlboom({ id: "2" }), filaAlboom({ id: "3" })];
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        analizar: analizarOk,
      },
    });
    expect(r.estado).toBe("OK");
    expect(r.leidas).toBe(3);
    expect(r.analizadas).toBe(3);
    expect(r.pendientes).toBe(0);
    expect(r.fallidas).toBe(0);
  });

  it("una segunda corrida sin cambios no vuelve a llamar a analizar", async () => {
    const { repo } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" })];
    const analizar = vi.fn(analizarOk);
    const deps = {
      leerCredencial: async () => CRED,
      crearCliente: async () => clienteFalso(filas),
      repo,
      iaDisponible: () => true,
      analizar,
    };
    const primera = await sincronizarWorkspace("w1", { deps });
    expect(primera.analizadas).toBe(1);

    const segunda = await sincronizarWorkspace("w1", { deps });
    expect(segunda.analizadas).toBe(0);
    expect(analizar).toHaveBeenCalledTimes(1);
  });

  it("forzarIds fuerza sólo esa oportunidad", async () => {
    const { repo } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" }), filaAlboom({ id: "2" })];
    const analizar = vi.fn(analizarOk);
    const deps = {
      leerCredencial: async () => CRED,
      crearCliente: async () => clienteFalso(filas),
      repo,
      iaDisponible: () => true,
      analizar,
    };
    await sincronizarWorkspace("w1", { deps });
    analizar.mockClear();

    const r = await sincronizarWorkspace("w1", { ...{ forzarIds: ["1"] }, deps });
    expect(r.analizadas).toBe(1);
    expect(analizar).toHaveBeenCalledTimes(1);
  });

  it("sin IA sincroniza y no analiza", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" })];
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => false,
      },
    });
    expect(r.estado).toBe("OK");
    expect(r.leidas).toBe(1);
    expect(r.analizadas).toBe(0);
    expect(oportunidades.size).toBe(1);
  });

  it("el deadline corta y deja pendientes > 0 con estado PARCIAL", async () => {
    const { repo } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" }), filaAlboom({ id: "2" }), filaAlboom({ id: "3" })];
    let ahora = 0;
    const r = await sincronizarWorkspace("w1", {
      deadlineMs: 10,
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        // Cada llamada a `ahora()` avanza el reloj: la primera lectura (antes del análisis) da 0,
        // y ya la primera comprobación dentro del pool ve pasado el plazo.
        ahora: () => new Date(ahora++ * 20),
        analizar: analizarOk,
      },
    });
    expect(r.estado).toBe("PARCIAL");
    expect(r.pendientes).toBeGreaterThan(0);
  });

  it("un detalle que falla no aborta la corrida y cuenta como PARCIAL", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1" }), filaAlboom({ id: "2" })];
    const cliente: ClienteAlboom = {
      async listarAbiertas() {
        return filas;
      },
      async detalle(id) {
        if (id === "1") throw new AlboomApiError("caído");
        return { activities: [], mails: [] };
      },
      async embudos() {
        return [];
      },
    };
    const r = await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => cliente,
        repo,
        iaDisponible: () => false,
      },
    });
    expect(r.estado).toBe("PARCIAL");
    expect(r.fallidas).toBe(1);
    expect(oportunidades.size).toBe(2);
  });
});
