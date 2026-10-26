/**
 * Lectura del sitio público de Alboom para el importador: sólo GET, con un User-Agent que se
 * identifica y como mucho 2 pedidos por segundo. Nada se escribe en Alboom.
 *
 * Red y espera entran como dependencias para poder probarlo sin internet.
 */

export const USER_AGENT_IMPORTADOR = "FOTOFFICE-importador/1.0";
/** 2 pedidos por segundo como máximo. */
export const ESPACIO_ENTRE_PEDIDOS_MS = 500;
const REINTENTOS = 2;

export type RespuestaFuente = { status: number; html: string };

export type FuenteAlboom = {
  /** GET de una ruta del sitio. Un 404 vuelve como `{ status: 404 }`, no como error. */
  traer(ruta: string, opciones?: { ajax?: boolean }): Promise<RespuestaFuente>;
};

export type DepsFuente = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
};

export function crearFuenteAlboom(base: string, parciales: Partial<DepsFuente> = {}): FuenteAlboom {
  const deps: DepsFuente = {
    fetch: (url, init) => fetch(url, init),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    ahora: () => Date.now(),
    ...parciales,
  };
  const raiz = base.replace(/\/+$/, "");
  let ultimo = 0;
  // Los pedidos van de a uno: una cola encadenada garantiza el espacio aunque se llame en paralelo.
  let cola: Promise<unknown> = Promise.resolve();

  async function turno() {
    const falta = ultimo + ESPACIO_ENTRE_PEDIDOS_MS - deps.ahora();
    if (falta > 0) await deps.esperar(falta);
    ultimo = deps.ahora();
  }

  async function pedir(ruta: string, ajax: boolean): Promise<RespuestaFuente> {
    const url = `${raiz}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
    let error: unknown = null;
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      if (intento > 0) await deps.esperar(1000 * intento);
      await turno();
      try {
        const res = await deps.fetch(url, {
          redirect: "follow",
          headers: { "User-Agent": USER_AGENT_IMPORTADOR, ...(ajax ? { "X-Requested-With": "XMLHttpRequest" } : {}) },
          signal: AbortSignal.timeout(30_000),
        });
        // Un error del servidor puede ser pasajero; el resto (404, 403) es la respuesta.
        if (res.status >= 500 && intento < REINTENTOS) continue;
        return { status: res.status, html: res.ok ? await res.text() : "" };
      } catch (err) {
        error = err;
      }
    }
    throw error instanceof Error ? error : new Error(`No se pudo leer ${url}`);
  }

  return {
    traer(ruta, opciones = {}) {
      const p = cola.then(() => pedir(ruta, Boolean(opciones.ajax)));
      cola = p.catch(() => undefined);
      return p;
    },
  };
}
