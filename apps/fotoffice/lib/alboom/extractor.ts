import type { Avance, AvanceEntidad } from "./avance";
import { AlboomApiError, AlboomLoginError, AlboomRutaNoPermitidaError, type ClienteAlboom, type PedidoLectura } from "./client";
import { avanceEntidadInicial, MAX_FALLIDOS, MAX_SALTADAS, MAX_TOCADOS } from "./avance";
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
 * - En los detalles por registro (`porPadre`), un 5xx en un registro tiene UNA pausa (`REINTENTAR`) al empezar una
 *   racha de fallas; si vuelve a fallar se cuenta como error de ese registro y se sigue, y los siguientes de la
 *   racha se saltean sin pausa. Si los primeros `FALLAS_SIN_EXITO` registros fallan sin un solo éxito, el endpoint
 *   está roto: la entidad queda en `ERROR` con el motivo y la extracción sigue con las demás. Con éxitos previos,
 *   cada `FALLAS_SEGUIDAS_PAUSA` fallas seguidas vuelve a hacer una pausa (por si Alboom se cayó un rato).
 * - En los listados paginados, un 5xx tiene UNA pausa (`REINTENTAR`); si la misma página vuelve a fallar, se pide
 *   ese mismo tramo con páginas más chicas (25 → 5 → 1), calculando `pageNumber` desde el desplazamiento absoluto,
 *   así no se saltea ni se repite ninguna fila. Si una fila sola sigue fallando, se "sondean" las siguientes (de a
 *   una, hasta `SONDEO_FILAS`): si alguna responde, Alboom anda y las que fallaron están rotas, se saltean (con una
 *   duda, sólo el desplazamiento) y se sigue: un pedido roto no deja la extracción en `ERROR`. Si ninguna responde,
 *   Alboom está caído: `REINTENTAR` SIN mover el cursor, así una caída general termina en pausas (o en `ERROR` tras
 *   muchas) pero nunca en filas salteadas.
 * - Con orden descendente (o en un tramo chico), una página igual a la anterior puede ser un corrimiento (entraron
 *   registros nuevos arriba): se sigue avanzando (repetir filas no duplica, se guardan por id) y sólo se frena tras
 *   `REPETIDAS_MAX` repeticiones seguidas.
 * - Si cambia `Entidad.version` (se corrigió cómo pedir), esa entidad se rehace desde cero.
 * - Sin tiempo → `PAUSADA`.
 *
 * "Volver a extraer" (`modo: "INCREMENTAL"`): los hijos por padre que REFLEJAN la fila del padre (el detalle con
 * el mismo id, `mismoId`, y los historiales de etapas, `reflejaPadre`) se piden sólo de los padres que hacen falta.
 * Los que pueden cambiar sin que cambie el padre (correos, notas, actividades, ítems, costos, participantes,
 * combos) se piden siempre de todos. Para los primeros, sin tocar el esquema de la base. Cada entidad padre anota en el avance los ids nuevos o cambiados de
 * huella en esta extracción (`tocados`, con tope); cada hijo anota los padres que fallaron (`fallidos`). Al
 * empezar un hijo se busca, en las extracciones anteriores (`anteriores`, de la más nueva a la más vieja), la
 * última donde ese hijo quedó `LISTA` con la misma versión (el "ancla": ahí se pidieron los hijos de todos los
 * padres que existían). Se piden los hijos de: lo tocado en esta extracción, lo tocado en las extracciones entre
 * el ancla y esta (que se cortaron antes de llegar al hijo) y lo que falló en el ancla. Si falta cualquier dato
 * (sin ancla, un avance viejo sin `tocados`, una lista desbordada, un ancla vieja con errores) se piden todos,
 * como en "Extraer todo".
 */

export type FilaCruda = { alboomId: string; payload: unknown; hash: string };

export type Almacen = {
  /**
   * Inserta lo nuevo, reescribe lo que cambió de huella y sólo marca `fetchedAt` en lo igual. `tocados`: los ids
   * nuevos o cambiados (si no viene y hubo cambios, "Volver a extraer" pide los hijos de todos).
   */
  guardarFilas(
    workspaceId: string,
    entity: string,
    filas: FilaCruda[],
  ): Promise<{ nuevos: number; cambiados: number; iguales: number; tocados?: string[] }>;
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
  /** "Extraer todo" (por defecto) o "Volver a extraer". */
  modo?: "TODO" | "INCREMENTAL";
  /** Avances de las extracciones anteriores del workspace, de la más nueva a la más vieja (sólo INCREMENTAL). */
  anteriores?: readonly Avance[];
};

const MAX_PAGINAS = 5000;
const MAX_OFFSET_POR_PADRE = 50_000;
const LOTE_PADRES = 25;
const LOTE_PADRES_SALTEANDO = 200;
const ID_MAX = 200;
/** Registros hijos seguidos que fallan, sin ningún éxito en la entidad, para darla por rota (`ERROR`). */
export const FALLAS_SIN_EXITO = 10;
/** Con éxitos previos: cada tantas fallas seguidas vuelve a hacer una pausa antes de seguir salteando. */
export const FALLAS_SEGUIDAS_PAUSA = 10;

/** Filas siguientes que se prueban, de a una, antes de saltear una que falla sola. */
export const SONDEO_FILAS = 3;
/** Páginas iguales seguidas (en orden descendente o tramo chico) antes de frenar el listado. */
export const REPETIDAS_MAX = 3;

/** Tamaños de página más chicos para reintentar un tramo que dio 5xx. */
const ESCALERA = [25, 5, 1] as const;

/** El próximo tamaño más chico que divide al actual (así el desplazamiento siempre cae en un borde de página). */
export function tamanoMenor(tamano: number): number | null {
  for (const t of ESCALERA) if (t < tamano && tamano % t === 0) return t;
  return tamano > 1 ? 1 : null;
}

/** ¿El hijo es un reflejo de la fila del padre (si el padre no cambió, él tampoco)? */
export function reflejaPadre(entidad: Entidad): boolean {
  const f = entidad.fuente;
  return f.tipo === "porPadre" && (f.mismoId === true || f.reflejaPadre === true);
}

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
  const modo = o.modo ?? "TODO";
  const anteriores = o.anteriores ?? [];
  /** Entidades de las que cuelgan hijos `porPadre`: anotan lo nuevo o cambiado (`tocados`). */
  const padres = new Set([...ENTIDADES, ...entidades].flatMap((x) => (x.fuente.tipo === "porPadre" && reflejaPadre(x) ? [x.fuente.padre] : [])));

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
    if (padres.has(entidad.clave) && !e.tocadosDesbordado && r.nuevos + r.cambiados > 0) {
      const lista = e.tocados ?? [];
      const ids = r.tocados;
      if (!ids || lista.length + ids.length > MAX_TOCADOS) {
        e.tocadosDesbordado = true;
        delete e.tocados;
      } else {
        const ya = new Set(lista);
        e.tocados = [...lista, ...ids.filter((id) => !ya.has(id))];
      }
    }
  }

  /**
   * "Volver a extraer": los padres cuyos hijos hay que pedir, o `null` para pedirlos todos (ver el comentario de
   * arriba). Determinístico: una tanda que retoma calcula lo mismo.
   */
  function padresAPedir(entidad: Entidad, padre: string): Set<string> | null {
    if (modo !== "INCREMENTAL" || !reflejaPadre(entidad)) return null;
    const ep = avance.entidades[padre];
    if (!ep || ep.tocadosDesbordado || ep.tocados === undefined) return null;
    const pedir = new Set(ep.tocados);
    const version = entidad.version ?? 1;
    for (const previo of anteriores) {
      const pc = previo.entidades[entidad.clave];
      const pp = previo.entidades[padre];
      if (pc && pc.estado === "LISTA") {
        if ((pc.version ?? 1) !== version) return null;
        if (pc.fallidosDesbordado) return null;
        // Un ancla de antes de este cambio no anotó qué padres fallaron: si hubo errores, no se sabe cuáles.
        if (pc.fallidos === undefined) return pc.errores > 0 ? null : pedir;
        for (const id of pc.fallidos) pedir.add(id);
        return pedir;
      }
      // No llegó a terminar este hijo: lo que cambió en sus padres puede no haber bajado a los hijos.
      if (pp && (pp.paginas > 0 || pp.cantidad > 0)) {
        if (pp.tocadosDesbordado || pp.tocados === undefined) return null;
        for (const id of pp.tocados) pedir.add(id);
      }
    }
    return null;
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
    if (Number.isFinite(total) && leidas + (e.saltados ?? 0) < total) {
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
        const base = entidad.tamanoPagina ?? tam;
        const descendente = f.body(1, base).sortDir === "DESC";
        // Avance viejo: el cursor era la página (con el tamaño de siempre).
        if (e.desde === undefined) e.desde = e.pagina && e.pagina > 1 ? (e.pagina - 1) * base : 0;
        for (;;) {
          let cursor: number = e.desde ?? 0;
          while (e.tramos && e.tramos.length > 0 && cursor >= e.tramos[e.tramos.length - 1]!.hasta) e.tramos.pop();
          if (e.tramos && e.tramos.length === 0) delete e.tramos;
          const tamano = e.tramos?.[e.tramos.length - 1]!.tamano ?? base;
          // Un cursor que no cae en un borde de página (no debería pasar) vuelve al borde anterior: repetir filas
          // no duplica nada (se guardan por id), saltearlas sí perdería datos.
          if (cursor % tamano !== 0) cursor -= cursor % tamano;
          e.desde = cursor;
          const desde: number = cursor;
          const pagina = desde / tamano + 1;
          if (Math.floor(desde / base) + 1 > MAX_PAGINAS) return errorDeEntidad(e, "Demasiadas páginas: se frenó para no quedar dando vueltas", true);
          let json: unknown;
          try {
            json = await pedir(e, { method: "POST", ruta: f.ruta, body: f.body(pagina, tamano) });
          } catch (error) {
            const es5xx = error instanceof AlboomApiError && error.transitorio && (error.status ?? 0) >= 500;
            if (!es5xx) throw error;
            const enTramo = (e.tramos?.length ?? 0) > 0;
            // La primera vez, la pausa de siempre (la próxima tanda repite esta página).
            if (!enTramo && avance.reintentos < 1) throw error;
            const menor = tamanoMenor(tamano);
            if (menor !== null) {
              e.tramos = [...(e.tramos ?? []), { tamano: menor, hasta: desde + tamano }];
              await guardarAvance(e);
              continue;
            }
            // Una sola fila y sigue fallando. ¿Está rota esa fila o está caído Alboom? Se prueban las siguientes.
            let rotas = 0;
            for (let k = 1; k <= SONDEO_FILAS; k++) {
              try {
                await pedir(e, { method: "POST", ruta: f.ruta, body: f.body(desde + k + 1, 1) });
                rotas = k;
                break;
              } catch (otro) {
                const otro5xx = otro instanceof AlboomApiError && otro.transitorio && (otro.status ?? 0) >= 500;
                if (!otro5xx) throw otro;
              }
            }
            // Ninguna respondió: Alboom está caído. Pausa sin mover el cursor; nunca se saltea por una caída.
            if (rotas === 0) throw error;
            // Alboom anda y estas filas no: se saltean (sólo el desplazamiento, sin datos) y se sigue. La que
            // respondió se vuelve a pedir en la vuelta siguiente (es un pedido de más, pero el camino es uno solo).
            e.saltados = (e.saltados ?? 0) + rotas;
            e.errores += rotas;
            e.dudas += rotas;
            for (let k = 0; k < rotas && (e.filasSalteadas?.length ?? 0) < MAX_SALTADAS; k++) e.filasSalteadas = [...(e.filasSalteadas ?? []), desde + k];
            e.ultimoError = `Alboom respondió ${(error as AlboomApiError).status} en la fila ${desde + 1} del listado aun pidiéndola sola (y las siguientes sí respondieron): se salteó`;
            e.desde = desde + rotas;
            e.pagina = Math.floor((desde + rotas) / base) + 1;
            await guardarAvance(e);
            continue;
          }
          const filas = filasDeLista(json);
          if (filas === null) return errorDeEntidad(e, FORMA, true);
          const total = esObjeto(json) && json.count != null && json.count !== "" ? Number(json.count) : NaN;
          if (Number.isFinite(total)) e.total = total;
          if (filas.length > 0) {
            const firma = firmaDePagina(filas, entidad.claves);
            if (firma === e.huellaPagina) {
              // En orden descendente (o de a pocas filas) puede ser un corrimiento por registros nuevos: se sigue.
              if (!(descendente || tamano < base)) return paginaRepetida(e);
              e.repetidas = (e.repetidas ?? 0) + 1;
              if (e.repetidas >= REPETIDAS_MAX) return paginaRepetida(e);
            } else delete e.repetidas;
            e.huellaPagina = firma;
          }
          await guardarFilas(entidad, e, filas, null);
          e.leidas = (e.leidas ?? 0) + filas.length;
          e.desde = desde + tamano;
          e.pagina = Math.floor((desde + tamano) / base) + 1;
          // Con `count`, sólo termina al llegar al total o con una página vacía: una página corta (Alboom puede
          // limitar el tamaño) no es el final. Sin `count`, la página corta sí lo es. Las filas salteadas cuentan.
          const vistas = e.leidas + (e.saltados ?? 0);
          const fin = Number.isFinite(total) ? filas.length === 0 || vistas >= total : filas.length === 0 || filas.length < tamano;
          if (fin) {
            if (Number.isFinite(total)) faltantes(e, total);
            delete e.tramos;
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
        const soloEstos = padresAPedir(entidad, f.padre);
        if (soloEstos) e.salteados ??= 0;
        for (;;) {
          // Salteando padres sin cambios casi no hay pedidos: lotes más grandes, menos idas a la base.
          const lote = await o.almacen.leerLote(o.workspaceId, f.padre, e.padre ?? null, soloEstos ? LOTE_PADRES_SALTEANDO : LOTE_PADRES);
          if (lote.length === 0) {
            e.estado = "LISTA";
            await guardarAvance(e);
            return;
          }
          /**
           * Un registro hijo falló (5xx ya pausado, 404/400, forma desconocida). Devuelve `true` si la entidad quedó
           * en `ERROR` por fallar sistemáticamente (ningún éxito en los primeros `FALLAS_SIN_EXITO`).
           */
          const fallaDeHijo = async (idPadre: string, motivo: string, duda = false): Promise<boolean> => {
            e.errores++;
            if (!e.fallidosDesbordado) {
              const lista = e.fallidos ?? [];
              if (lista.length >= MAX_FALLIDOS) {
                e.fallidosDesbordado = true;
                delete e.fallidos;
              } else if (!lista.includes(idPadre)) e.fallidos = [...lista, idPadre];
            }
            if (duda) e.dudas++;
            e.ultimoError = motivo;
            e.fallasSeguidas = (e.fallasSeguidas ?? 0) + 1;
            if ((e.exitos ?? 0) === 0 && e.fallasSeguidas >= FALLAS_SIN_EXITO) {
              e.estado = "ERROR";
              e.ultimoError = `Alboom falló en los primeros ${e.fallasSeguidas} registros sin ningún éxito; se dejó de pedir este detalle y se siguió con lo demás. Último error: ${motivo}`.slice(0, 300);
              await guardarAvance(e);
              return true;
            }
            // Con éxitos previos, una racha larga puede ser Alboom caído: la próxima falla vuelve a pausar.
            if (e.fallasSeguidas >= FALLAS_SEGUIDAS_PAUSA) e.fallasSeguidas = 0;
            return false;
          };
          for (const p of lote) {
            if (f.filtro && !f.filtro(p.payload)) {
              e.padre = p.alboomId;
              continue;
            }
            // "Volver a extraer": un padre sin cambios (y cuyos hijos ya se pidieron bien) no se vuelve a pedir.
            if (soloEstos && !soloEstos.has(p.alboomId)) {
              e.padre = p.alboomId;
              e.salteados = (e.salteados ?? 0) + 1;
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
                if (!esDeEntidad(error)) {
                  // 429, red, sin tiempo, base: se corta la tanda como siempre. Un 429 no se saltea nunca.
                  const es5xx = error instanceof AlboomApiError && error.transitorio && (error.status ?? 0) >= 500;
                  if (!es5xx) throw error;
                  // Un 5xx en el MISMO registro no puede trabar la extracción: la primera falla de una racha tiene
                  // una pausa (REINTENTAR, la próxima tanda repite este registro); después se cuenta y se sigue.
                  if ((e.fallasSeguidas ?? 0) === 0 && avance.reintentos < 1) throw error;
                  avance.reintentos = 0;
                  avance.reintentarDesde = null;
                }
                if (await fallaDeHijo(p.alboomId, mensaje(error))) return;
                break;
              }
              if (filas === null) {
                if (await fallaDeHijo(p.alboomId, FORMA, true)) return;
                break;
              }
              e.exitos = (e.exitos ?? 0) + 1;
              e.fallasSeguidas = 0;
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
      let e = (avance.entidades[entidad.clave] ??= {
        ...avanceEntidadInicial(),
        ...(entidad.version !== undefined ? { version: entidad.version } : {}),
      });
      // Se corrigió cómo pedir esta entidad: lo recorrido con la forma vieja no sirve (cursor, errores). Se rehace
      // desde cero, aunque estuviera en ERROR o LISTA; lo ya guardado crudo se reescribe por huella.
      if (entidad.version !== undefined && (e.version ?? 1) !== entidad.version && e.estado !== "NO_DISPONIBLE") {
        e = avance.entidades[entidad.clave] = { ...avanceEntidadInicial(), version: entidad.version };
      }
      if (e.estado === "LISTA" || e.estado === "ERROR" || e.estado === "NO_DISPONIBLE") continue;
      // Un padre que empieza de cero anota lo que cambia; uno que ya venía con el código viejo (sin `tocados`) no
      // sabe qué cambió antes: sus hijos se piden todos.
      if (padres.has(entidad.clave) && e.tocados === undefined && !e.tocadosDesbordado) {
        if (e.paginas === 0 && e.cantidad === 0) e.tocados = [];
        else e.tocadosDesbordado = true;
      }
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
