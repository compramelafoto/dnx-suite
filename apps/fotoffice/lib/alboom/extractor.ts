import type { Avance, AvanceEntidad } from "./avance";
import { AlboomApiError, AlboomLoginError, AlboomRutaNoPermitidaError, type ClienteAlboom, type PedidoLectura } from "./client";
import { ENTIDADES, TAMANO_PAGINA, filasDeLista, type Entidad } from "./entidades";
import { huella } from "./huella";
import { redactarSecretos } from "./redactar";

/**
 * El motor de la extracción: recorre el catálogo en orden y, para cada entidad, pide a Alboom, arma los registros
 * (id + huella) y los guarda crudos. Avanza de a un pedido y guarda el cursor después de cada uno, así una tanda
 * cortada por tiempo (o por el fin de la función) retoma exactamente donde quedó.
 *
 * No sabe de Prisma ni de credenciales: recibe un cliente ya conectado, un almacén y una función para guardar el
 * avance (que devuelve `false` si la extracción ya no está corriendo, p. ej. porque la cancelaron).
 *
 * Cómo reacciona:
 * - `AlboomLoginError` → `CREDENCIAL` (hay que volver a conectar; frena todo).
 * - `AlboomApiError` transitorio (429, 5xx, red) → `REINTENTAR` sin mover el cursor: la próxima tanda lo repite.
 * - Otro `AlboomApiError` (404, 400, forma desconocida) → error de ESA entidad (o de ese padre) y sigue.
 * - Sin tiempo → `PAUSADA`.
 */

export type FilaCruda = { alboomId: string; payload: unknown; hash: string };

export type Almacen = {
  /** Inserta lo nuevo, reescribe lo que cambió de huella y sólo marca `fetchedAt` en lo igual. */
  guardarFilas(workspaceId: string, entity: string, filas: FilaCruda[]): Promise<{ nuevos: number; cambiados: number; iguales: number }>;
  /** Registros ya extraídos de una entidad, ordenados por `alboomId`, después de `despuesDe`. */
  leerLote(workspaceId: string, entity: string, despuesDe: string | null, limite: number): Promise<{ alboomId: string; payload: unknown }[]>;
};

export type ResultadoTanda = {
  resultado: "COMPLETA" | "PAUSADA" | "CANCELADA" | "REINTENTAR" | "CREDENCIAL";
  avance: Avance;
  /** Legible y sin datos de la cuenta. */
  motivo?: string;
};

export type OpcionesTanda = {
  workspaceId: string;
  cliente: ClienteAlboom;
  almacen: Almacen;
  avance: Avance;
  ahora: () => number;
  /** Hora límite (ms). Antes de cada pedido se deja `margenMs` para que el pedido y su guardado entren. */
  limite: number;
  margenMs?: number;
  guardar: (avance: Avance) => Promise<boolean>;
  /** Para pruebas: otro catálogo u otro tamaño de página. */
  entidades?: readonly Entidad[];
  tamanoPagina?: number;
};

const MAX_PAGINAS = 5000;
const MAX_OFFSET_POR_PADRE = 50_000;
const LOTE_PADRES = 25;
const ID_MAX = 200;
/** Tandas seguidas con 5xx en el mismo registro hijo antes de saltearlo. */
export const REINTENTOS_PARA_SALTEAR = 3;

class SinTiempo extends Error {}
class Cancelada extends Error {}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `id`, y si no, las claves propias de la entidad. Números o texto no vacío (y no larguísimo). */
export function detectarId(fila: unknown, claves: readonly string[] = []): string | null {
  if (!esObjeto(fila)) return null;
  for (const k of ["id", ...claves]) {
    const v = fila[k];
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim() !== "" && v.length <= ID_MAX) return v.trim();
  }
  return null;
}

/**
 * Filas → registros con id y huella. `prefijo` es el id del padre (hijos) o la clave del pedido (`varias`).
 * Devuelve también cuántas dudas hubo: sin id cuando se esperaba, o ids repetidos en la misma respuesta.
 */
export function armarFilas(entidad: Entidad, filas: unknown[], prefijo: string | null, mismoId = false): { filas: FilaCruda[]; dudas: number } {
  const porId = new Map<string, FilaCruda>();
  let dudas = 0;
  for (const crudo of filas) {
    // Sin secretos de terceros (claves API, tarjetas, SMTP, tokens): ver `redactar.ts`.
    const payload = redactarSecretos(crudo);
    const hash = huella(payload);
    let id: string;
    if (mismoId && prefijo) id = prefijo;
    else {
      const propio = entidad.idFijo ?? detectarId(payload, entidad.claves);
      if (propio === null && entidad.idEsperado !== false) dudas++;
      const base = propio ?? `h${hash.slice(0, 32)}`;
      id = prefijo ? `${prefijo}/${base}` : base;
    }
    if (porId.has(id)) dudas++;
    porId.set(id, { alboomId: id, payload: payload ?? null, hash });
  }
  return { filas: [...porId.values()], dudas };
}

function mensaje(error: unknown): string {
  if (error instanceof AlboomApiError || error instanceof AlboomRutaNoPermitidaError) return error.message.slice(0, 300);
  return "Error inesperado al leer Alboom";
}

const FORMA = "Alboom respondió con una forma desconocida";

export async function ejecutarTanda(o: OpcionesTanda): Promise<ResultadoTanda> {
  const avance = o.avance;
  const entidades = o.entidades ?? ENTIDADES;
  const tam = o.tamanoPagina ?? TAMANO_PAGINA;
  // 25 s antes del límite de la tanda (270 s) no se arranca otro pedido. El peor caso de un pedido (espera de 1 s +
  // pedido con 401 + nuevo inicio de sesión + reintento, 15 s cada uno) termina antes de los 300 s de la función.
  const margen = o.margenMs ?? 25_000;

  async function guardarAvance(e: AvanceEntidad): Promise<void> {
    e.actualizado = new Date(o.ahora()).toISOString();
    if (!(await o.guardar(avance))) throw new Cancelada();
  }

  async function pedir(e: AvanceEntidad, pedido: PedidoLectura): Promise<unknown> {
    if (o.ahora() + margen > o.limite) throw new SinTiempo();
    const json = await o.cliente.leer(pedido);
    avance.pedidos++;
    avance.reintentos = 0;
    avance.reintentarDesde = null;
    e.paginas++;
    return json;
  }

  async function guardarFilas(entidad: Entidad, e: AvanceEntidad, filas: unknown[], prefijo: string | null, mismoId = false): Promise<void> {
    const armado = armarFilas(entidad, filas, prefijo, mismoId);
    e.dudas += armado.dudas;
    if (armado.filas.length === 0) return;
    const r = await o.almacen.guardarFilas(o.workspaceId, entidad.clave, armado.filas);
    e.cantidad += armado.filas.length;
    e.nuevos += r.nuevos;
    e.cambiados += r.cambiados;
    e.iguales += r.iguales;
  }

  async function errorDeEntidad(e: AvanceEntidad, motivo: string, duda = false): Promise<void> {
    e.estado = "ERROR";
    e.errores++;
    if (duda) e.dudas++;
    e.ultimoError = motivo;
    await guardarAvance(e);
  }

  /**
   * ¿Es un error que se queda en la entidad (o en el padre)? Sólo los de Alboom que no se arreglan esperando: 404,
   * 400, respuesta no JSON, redirección, ruta fuera de la lista blanca. Todo lo demás corta la tanda: sin tiempo,
   * cancelada, 401, 429/5xx/red, y también un error de la base (se reintenta en la próxima tanda).
   */
  function esDeEntidad(error: unknown): boolean {
    return (error instanceof AlboomApiError && !error.transitorio) || error instanceof AlboomRutaNoPermitidaError;
  }

  /** Firma de una página: cantidad, primer y último id. Si se repite, Alboom está ignorando la paginación. */
  function firmaDePagina(filas: unknown[], claves: readonly string[] = []): string {
    const id = (x: unknown) => detectarId(redactarSecretos(x), claves) ?? huella(redactarSecretos(x));
    return `${filas.length}|${id(filas[0])}|${id(filas[filas.length - 1])}`;
  }

  async function paginaRepetida(e: AvanceEntidad): Promise<void> {
    e.dudas++;
    e.ultimoError = "Alboom devolvió la misma página dos veces: se frenó para no quedar dando vueltas";
    e.estado = "LISTA";
    await guardarAvance(e);
  }

  /** Terminó con menos registros que los que Alboom dijo tener: queda la duda a la vista. */
  function faltantes(e: AvanceEntidad, total: number): void {
    const leidas = e.leidas ?? 0;
    if (Number.isFinite(total) && leidas < total) {
      e.dudas++;
      e.ultimoError = `Alboom informó ${total} registros y llegaron ${leidas}`;
    }
  }

  async function procesar(entidad: Entidad, e: AvanceEntidad): Promise<void> {
    const f = entidad.fuente;
    switch (f.tipo) {
      case "noDisponible": {
        e.estado = "NO_DISPONIBLE";
        e.ultimoError = f.motivo;
        await guardarAvance(e);
        return;
      }
      case "simple": {
        const json = await pedir(e, f.pedido);
        const filas = f.filas(json);
        if (filas === null) return errorDeEntidad(e, FORMA, true);
        await guardarFilas(entidad, e, filas, null);
        e.estado = "LISTA";
        await guardarAvance(e);
        return;
      }
      case "varias": {
        for (let i = e.sub ?? 0; i < f.pedidos.length; i++) {
          const { clave, pedido } = f.pedidos[i]!;
          try {
            const filas = f.filas(await pedir(e, pedido));
            if (filas === null) {
              e.errores++;
              e.dudas++;
              e.ultimoError = `${FORMA} (${clave})`;
            } else await guardarFilas(entidad, e, filas, clave);
          } catch (error) {
            if (!esDeEntidad(error)) throw error;
            e.errores++;
            e.ultimoError = mensaje(error);
          }
          e.sub = i + 1;
          await guardarAvance(e);
        }
        e.estado = "LISTA";
        await guardarAvance(e);
        return;
      }
      case "paginada": {
        for (;;) {
          const pagina = e.pagina ?? 1;
          if (pagina > MAX_PAGINAS) return errorDeEntidad(e, "Demasiadas páginas: se frenó para no quedar dando vueltas", true);
          const json = await pedir(e, { method: "POST", ruta: f.ruta, body: f.body(pagina, tam) });
          const filas = filasDeLista(json);
          if (filas === null) return errorDeEntidad(e, FORMA, true);
          const total = esObjeto(json) && json.count != null && json.count !== "" ? Number(json.count) : NaN;
          if (filas.length > 0) {
            const firma = firmaDePagina(filas, entidad.claves);
            if (firma === e.huellaPagina) return paginaRepetida(e);
            e.huellaPagina = firma;
          }
          await guardarFilas(entidad, e, filas, null);
          e.leidas = (e.leidas ?? 0) + filas.length;
          e.pagina = pagina + 1;
          // Con `count`, sólo termina al llegar al total o con una página vacía: una página corta (Alboom puede
          // limitar el tamaño) no es el final. Sin `count`, la página corta sí lo es.
          const fin = Number.isFinite(total) ? filas.length === 0 || e.leidas >= total : filas.length === 0 || filas.length < tam;
          if (fin) {
            if (Number.isFinite(total)) faltantes(e, total);
            e.estado = "LISTA";
          }
          await guardarAvance(e);
          if (fin) return;
        }
      }
      case "porDesplazamiento": {
        for (let vueltas = 0; ; vueltas++) {
          const offset = e.pagina ?? 0;
          if (vueltas > MAX_PAGINAS) return errorDeEntidad(e, "Demasiadas páginas: se frenó para no quedar dando vueltas", true);
          const filas = filasDeLista(await pedir(e, { method: "GET", ruta: f.ruta(offset) }));
          if (filas === null) return errorDeEntidad(e, FORMA, true);
          if (filas.length === 0) {
            e.estado = "LISTA";
            await guardarAvance(e);
            return;
          }
          // Si Alboom ignora el desplazamiento devuelve la misma página para siempre: se corta ahí.
          const firma = huella(filas.map((x) => detectarId(x, entidad.claves) ?? huella(x)));
          if (firma === e.huellaPagina) {
            e.dudas++;
            e.estado = "LISTA";
            await guardarAvance(e);
            return;
          }
          await guardarFilas(entidad, e, filas, null);
          e.huellaPagina = firma;
          e.pagina = offset + filas.length;
          await guardarAvance(e);
        }
      }
      case "porPadre": {
        for (;;) {
          const lote = await o.almacen.leerLote(o.workspaceId, f.padre, e.padre ?? null, LOTE_PADRES);
          if (lote.length === 0) {
            e.estado = "LISTA";
            await guardarAvance(e);
            return;
          }
          for (const p of lote) {
            if (f.filtro && !f.filtro(p.payload)) {
              e.padre = p.alboomId;
              continue;
            }
            // Los ids de Alboom son numéricos; uno armado por huella no sirve para pedir el detalle.
            if (!/^\d{1,12}$/.test(p.alboomId)) {
              e.errores++;
              e.dudas++;
              e.padre = p.alboomId;
              continue;
            }
            for (;;) {
              const offset = e.offset ?? 0;
              let filas: unknown[] | null;
              let total = NaN;
              try {
                const json = await pedir(e, f.pedido(p.alboomId, offset));
                filas = f.filas(json);
                if (esObjeto(json) && json.count != null && json.count !== "") total = Number(json.count);
              } catch (error) {
                // Un 5xx que se repite en el MISMO registro después de varias tandas no puede trabar toda la
                // extracción: ese registro se cuenta como error y se sigue. Un 429 no se saltea nunca.
                const atascado =
                  error instanceof AlboomApiError && error.transitorio && (error.status ?? 0) >= 500 && avance.reintentos >= REINTENTOS_PARA_SALTEAR;
                if (!esDeEntidad(error) && !atascado) throw error;
                if (atascado) avance.reintentos = 0;
                e.errores++;
                e.ultimoError = mensaje(error);
                break;
              }
              if (filas === null) {
                e.errores++;
                e.dudas++;
                e.ultimoError = FORMA;
                break;
              }
              if (f.paginaDe && filas.length > 0) {
                const firma = firmaDePagina(filas, entidad.claves);
                if (offset > 0 && firma === e.huellaPagina) {
                  e.dudas++;
                  e.ultimoError = "Alboom devolvió la misma página dos veces: se pasó al registro siguiente";
                  break;
                }
                e.huellaPagina = firma;
              }
              await guardarFilas(entidad, e, filas, p.alboomId, f.mismoId);
              // Con `count`, sigue hasta el total aunque la página venga corta; sin `count`, mientras venga llena.
              const leidas = offset + filas.length;
              const hayMas = Number.isFinite(total) ? filas.length > 0 && leidas < total : filas.length >= (f.paginaDe ?? Infinity);
              if (f.paginaDe && hayMas && leidas <= MAX_OFFSET_POR_PADRE) {
                e.offset = leidas;
                await guardarAvance(e);
                continue;
              }
              break;
            }
            e.padre = p.alboomId;
            delete e.offset;
            delete e.huellaPagina;
            await guardarAvance(e);
          }
          // Un lote entero de padres filtrados no hizo pedidos: igual se guarda el cursor.
          await guardarAvance(e);
        }
      }
      case "derivada": {
        for (;;) {
          if (o.ahora() + margen > o.limite) throw new SinTiempo();
          const lote = await o.almacen.leerLote(o.workspaceId, f.de, e.padre ?? null, 50);
          if (lote.length === 0) {
            e.estado = "LISTA";
            await guardarAvance(e);
            return;
          }
          for (const p of lote) {
            const filas = f.filas(p.payload);
            if (filas === null) {
              e.errores++;
              e.dudas++;
              e.ultimoError = FORMA;
            } else await guardarFilas(entidad, e, filas, p.alboomId);
            e.padre = p.alboomId;
          }
          await guardarAvance(e);
        }
      }
    }
  }

  try {
    for (const entidad of entidades) {
      const e = (avance.entidades[entidad.clave] ??= {
        estado: "PENDIENTE",
        paginas: 0,
        cantidad: 0,
        nuevos: 0,
        cambiados: 0,
        iguales: 0,
        errores: 0,
        dudas: 0,
      });
      if (e.estado === "LISTA" || e.estado === "ERROR" || e.estado === "NO_DISPONIBLE") continue;
      e.estado = "EN_CURSO";
      try {
        await procesar(entidad, e);
      } catch (error) {
        if (!esDeEntidad(error)) throw error;
        // 404, 400, ruta fuera de la lista blanca, respuesta no JSON: falla esta entidad y se sigue con la próxima.
        await errorDeEntidad(e, mensaje(error));
      }
    }
    return { resultado: "COMPLETA", avance };
  } catch (error) {
    if (error instanceof SinTiempo) {
      // El cursor ya quedó guardado con el último pedido bueno.
      return { resultado: "PAUSADA", avance };
    }
    if (error instanceof Cancelada) return { resultado: "CANCELADA", avance };
    if (error instanceof AlboomLoginError) {
      return { resultado: "CREDENCIAL", avance, motivo: "Alboom rechazó el usuario o la contraseña: hay que volver a conectar la cuenta." };
    }
    if (error instanceof AlboomApiError && error.transitorio) {
      return { resultado: "REINTENTAR", avance, motivo: mensaje(error) };
    }
    throw error;
  }
}
