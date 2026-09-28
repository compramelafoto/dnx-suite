import { describe, expect, it, vi } from "vitest";
import { AlboomApiError, AlboomLoginError, type ClienteAlboom, type CredencialAlboom } from "./alboom/client";
import type { AlboomLeadRow } from "./alboom/types";
import type { ResultadoAnalisis } from "./analyzer";
import type { AjustesVentas } from "./repository";
import type { RepoSync } from "./sync";
import { sincronizarWorkspace as sincronizarReal } from "./sync";
import { MAX_ANALISIS_POR_CORRIDA } from "./constants";
import type { OportunidadVenta } from "./opportunity";

/**
 * `sincronizarWorkspace` se prueba entero, de punta a punta, con dependencias falsas: un repo en
 * memoria (un `Map`), un cliente Alboom que responde lo que el test le arma y un `analizar` que
 * nunca toca la red. Nada de esto pega contra Prisma ni contra `fetch`.
 */

const CRED: CredencialAlboom = { subdomain: "foto", username: "u", password: "p" };

/**
 * Un reloj fijo para todas las corridas: la limpieza inicial (`esCandidataACerrar`) mira la fecha
 * del evento y los días sin movimiento, y con el reloj real estos fixtures "envejecerían" solos.
 */
const HOY = new Date("2026-09-28T13:00:00Z");

const sincronizarWorkspace: typeof sincronizarReal = (workspaceId, opciones) =>
  sincronizarReal(workspaceId, { ...opciones, deps: { ahora: () => HOY, ...opciones?.deps } });

function filaAlboom(overrides: Partial<AlboomLeadRow> = {}): AlboomLeadRow {
  return {
    id: "1",
    name: "Casamiento",
    description: null,
    status_id: "421",
    pipeline_id: "1",
    stage_id: "1",
    created: "2026-09-01 10:00",
    modified: "2026-09-20 10:00",
    event_date: "2027-06-01",
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
    // El reloj no se mueve mientras se lee Alboom; cada análisis lo adelanta 20 ms. Con un plazo
    // de 10 ms, entra el primer análisis y los demás quedan para la próxima corrida.
    let reloj = HOY.getTime();
    const r = await sincronizarWorkspace("w1", {
      deadlineMs: 10,
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        ahora: () => new Date(reloj),
        analizar: async () => {
          reloj += 20;
          return analizarOk();
        },
      },
    });
    expect(r.estado).toBe("PARCIAL");
    expect(r.analizadas).toBe(1);
    expect(r.pendientes).toBe(2);
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

  it("la limpieza inicial no pasa por Claude: las vencidas o quietas no se analizan, salvo forzadas", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const filas = [
      filaAlboom({ id: "1", name: "Viejo", event_date: "2018-05-01", modified: "2018-01-01 10:00" }),
      filaAlboom({ id: "2", name: "Quieto", event_date: null, modified: "2026-01-01 10:00" }),
      filaAlboom({ id: "3", name: "Vivo" }),
    ];
    const analizar = vi.fn(analizarOk);
    const deps = {
      leerCredencial: async () => CRED,
      crearCliente: async () => clienteFalso(filas),
      repo,
      iaDisponible: () => true,
      analizar,
    };
    const r = await sincronizarWorkspace("w1", { deps });
    expect(r.leidas).toBe(3);
    expect(r.analizadas).toBe(1);
    expect(r.pendientes).toBe(0);
    expect(analizar.mock.calls[0]![0]).toContain("Pedido: Vivo");
    // Se guardan igual: la pestaña «Para cerrar» las arma por regla desde la base.
    expect(oportunidades.size).toBe(3);

    analizar.mockClear();
    const forzada = await sincronizarWorkspace("w1", { forzarIds: ["1"], deps });
    expect(forzada.analizadas).toBe(1);
    expect(analizar.mock.calls[0]![0]).toContain("Pedido: Viejo");
  });

  it("la cola va con las forzadas primero y después por cercanía del evento (sin fecha al final)", async () => {
    const { repo } = repoEnMemoria();
    const filas = [
      filaAlboom({ id: "1", name: "Junio", event_date: "2027-06-01" }),
      filaAlboom({ id: "2", name: "SinFecha", event_date: null }),
      filaAlboom({ id: "3", name: "Noviembre", event_date: "2026-11-01" }),
      filaAlboom({ id: "4", name: "Forzada", event_date: "2027-12-01" }),
    ];
    const analizar = vi.fn(analizarOk);
    await sincronizarWorkspace("w1", {
      forzarIds: ["4"],
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        analizar,
      },
    });
    const orden = analizar.mock.calls.map((c) => /Pedido: (\w+)/.exec(String(c[0]))![1]);
    expect(orden).toEqual(["Forzada", "Noviembre", "Junio", "SinFecha"]);
  });

  it("una forzada no queda afuera del tope de análisis por corrida", async () => {
    const { repo } = repoEnMemoria();
    const filas = Array.from({ length: MAX_ANALISIS_POR_CORRIDA + 5 }, (_, i) =>
      filaAlboom({ id: String(i + 1), name: `Op${i + 1}` }),
    );
    const ultima = String(filas.length);
    const analizar = vi.fn(analizarOk);
    const r = await sincronizarWorkspace("w1", {
      forzarIds: [ultima],
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        analizar,
      },
    });
    expect(r.analizadas).toBe(MAX_ANALISIS_POR_CORRIDA);
    expect(r.pendientes).toBe(5);
    expect(analizar.mock.calls.some((c) => String(c[0]).includes(`Pedido: Op${ultima}\n`))).toBe(true);
  });

  it("el plazo se mide desde el comienzo: si se agota leyendo detalles, deja de pedirlos y queda PARCIAL", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    await sincronizarWorkspace("w1", {
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso([filaAlboom({ id: "1" }), filaAlboom({ id: "2" })]),
        repo,
        iaDisponible: () => false,
      },
    });
    const modificadaAntes = oportunidades.get("1")!.snapshot.modificadaEn;

    // Segunda corrida: las dos cambiaron en Alboom y aparece una nueva, pero el reloj ya pasó el
    // plazo antes de pedir el primer detalle.
    const filas = [
      filaAlboom({ id: "1", modified: "2026-09-25 10:00" }),
      filaAlboom({ id: "2", modified: "2026-09-25 10:00" }),
      filaAlboom({ id: "3" }),
    ];
    let detalles = 0;
    const cliente: ClienteAlboom = {
      ...clienteFalso(filas),
      async detalle() {
        detalles++;
        return { activities: [], mails: [] };
      },
    };
    let t = 0;
    const r = await sincronizarWorkspace("w1", {
      deadlineMs: 10,
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => cliente,
        repo,
        iaDisponible: () => false,
        ahora: () => new Date(HOY.getTime() + t++ * 20),
      },
    });
    expect(detalles).toBe(0);
    expect(r.estado).toBe("PARCIAL");
    // La que ya estaba conserva su snapshot (y su fecha): la próxima corrida la vuelve a leer.
    expect(oportunidades.get("1")!.snapshot.modificadaEn).toEqual(modificadaAntes);
    // La nueva, sin detalle ni snapshot previo, espera a la próxima corrida.
    expect(oportunidades.has("3")).toBe(false);
  });

  it("un análisis fallido se reintenta en la corrida siguiente", async () => {
    const { repo } = repoEnMemoria();
    const analizar = vi
      .fn(analizarOk)
      .mockImplementationOnce(async () => ({ ...(await analizarOk()), fallo: true }));
    const deps = {
      leerCredencial: async () => CRED,
      crearCliente: async () => clienteFalso([filaAlboom({ id: "1" })]),
      repo,
      iaDisponible: () => true,
      analizar,
    };
    const primera = await sincronizarWorkspace("w1", { deps });
    expect(primera.fallidas).toBe(1);
    const segunda = await sincronizarWorkspace("w1", { deps });
    expect(segunda.analizadas).toBe(1);
    expect(analizar).toHaveBeenCalledTimes(2);
  });

  it("soloForzadas lee Alboom pero analiza sólo las forzadas", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const filas = [filaAlboom({ id: "1", name: "Pedida" }), filaAlboom({ id: "2", name: "Otra" })];
    const analizar = vi.fn(analizarOk);
    const r = await sincronizarWorkspace("w1", {
      forzarIds: ["1"],
      soloForzadas: true,
      deps: {
        leerCredencial: async () => CRED,
        crearCliente: async () => clienteFalso(filas),
        repo,
        iaDisponible: () => true,
        analizar,
      },
    });
    expect(oportunidades.size).toBe(2);
    expect(r.analizadas).toBe(1);
    expect(r.pendientes).toBe(0);
    expect(analizar).toHaveBeenCalledTimes(1);
    expect(analizar.mock.calls[0]![0]).toContain("Pedido: Pedida");
  });

  it("si Alboom devuelve una lista vacía sin error, no cierra nada", async () => {
    const { repo, oportunidades } = repoEnMemoria();
    const base = { leerCredencial: async () => CRED, repo, iaDisponible: () => false };
    await sincronizarWorkspace("w1", { deps: { ...base, crearCliente: async () => clienteFalso([filaAlboom({ id: "1" })]) } });
    await sincronizarWorkspace("w1", { deps: { ...base, crearCliente: async () => clienteFalso([]) } });
    expect(oportunidades.get("1")!.snapshot.abierta).toBe(true);
  });
});
