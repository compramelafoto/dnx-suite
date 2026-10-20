import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { armarMarca, type BrandingMarca } from "./marca";
import { argumentosFfmpeg, armarPlan } from "./plan";
import type { Repo } from "./repo";


export type DepsConvertir = {
  repo: Repo;
  leerParte(clave: string): Promise<Buffer>;
  subirStream(clave: string, stream: Readable, señal?: AbortSignal): Promise<number>;
  borrarPrefijo(prefijo: string): Promise<void>;
  preset: string;
  ffmpegPath?: string;
  /** Esperas entre reintentos de escrituras a la base (default 2/5/15/30 s). */
  esperasMs?: number[];
  /** Cada cuánto se renueva el token de bloqueo (default 5 min). */
  renovarMs?: number;
  /** Sin progreso de ffmpeg durante este tiempo, se lo mata. Default 10 min. */
  inactividadMs?: number;
  cargarLogo?: (url: string) => Promise<Buffer | null>;
  /** Carpeta donde crear la carpeta temporal (default os.tmpdir()). */
  tmpBase?: string;
  /** Instante de las pruebas; ignorado en producción. */
  registrar?: (msg: string) => void;
  /** Sólo para pruebas: se llama con el proceso recién lanzado. */
  alLanzar?: (ff: import("node:child_process").ChildProcess) => void;
};

function aSegundos(hms: string): number {
  const [h, m, s] = hms.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}


/** Entrada de ffmpeg: un socket del hijo. Si ffmpeg ya no lee (cerró, murió o dejó de necesitar la
 * entrada, p. ej. por un recorte), cualquier error del socket sólo significa "el lector se fue". */
type Entrada = { ws: Writable; ido: boolean };

function vigilarEntrada(ws: Writable): Entrada {
  const e: Entrada = { ws, ido: false };
  // Permanente desde el spawn: un 'error' sin oyente (ECONNRESET, EPIPE...) tumbaría el proceso.
  ws.on("error", () => (e.ido = true));
  ws.on("close", () => (e.ido = true));
  return e;
}

/** Escribe con contrapresión. Devuelve false si el lector se fue (no es un error). */
function escribirTodo(e: Entrada, buf: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    if (e.ido || e.ws.destroyed || !e.ws.writable) {
      e.ido = true;
      resolve(false);
      return;
    }
    const fin = (ok: boolean) => {
      e.ws.off("error", alError);
      e.ws.off("close", alCerrar);
      e.ws.off("drain", alDrenar);
      resolve(ok);
    };
    const alError = () => fin(false);
    const alCerrar = () => fin(false);
    const alDrenar = () => fin(true);
    e.ws.once("error", alError);
    e.ws.once("close", alCerrar);
    const ok = e.ws.write(buf, (err) => {
      if (err) fin(false);
    });
    if (ok) fin(true);
    else e.ws.once("drain", alDrenar);
  });
}

/**
 * Un escritor por entrada. ffmpeg lee cada entrada de un descriptor propio (`-i pipe:N`, un socket
 * del proceso hijo): no hay archivos ni aperturas bloqueantes, así que ninguna cantidad de tramos
 * agota los hilos de libuv. Cada parte se baja entera de R2 y recién ahí se escribe.
 * Sólo los fallos de lectura de R2 (`leerParte`) hacen fallar al escritor.
 */
async function alimentar(
  e: Entrada,
  claves: string[],
  deps: DepsConvertir,
  abortado: () => boolean,
): Promise<void> {
  try {
    for (const clave of claves) {
      if (abortado() || e.ido) break;
      let buf: Buffer;
      try {
        buf = await deps.leerParte(clave);
      } catch (err) {
        if (abortado() || e.ido) break; // el lector ya se fue: nadie necesita esta parte
        throw err;
      }
      if (abortado() || e.ido) break;
      if (!(await escribirTodo(e, buf))) break;
    }
  } finally {
    if (!e.ws.destroyed) e.ws.end();
  }
}

/** Lo que ve la persona en la pantalla: sólo la causa, corta. El detalle de ffmpeg va a los logs. */
export function mensajeError(causa: string): string {
  return causa.replace(/\s+/g, " ").trim().slice(0, 200);
}

const ESPERAS_DB_MS = [2000, 5000, 15000, 30000];

/** Reintenta una escritura a la base ante errores transitorios (un 0 filas NO es error). */
async function conReintentos<T>(deps: DepsConvertir, que: string, fn: () => Promise<T>): Promise<T> {
  const esperas = deps.esperasMs ?? ESPERAS_DB_MS;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= esperas.length) throw e;
      (deps.registrar ?? console.log)(`${que} falló (${e instanceof Error ? e.message : e}); reintento en ${esperas[i]} ms`);
      await new Promise((r) => setTimeout(r, esperas[i]));
    }
  }
}

/**
 * `lockAt` es el token de propiedad que devolvió `tomarSiguiente`: todo cierre en la base exige
 * que siga siendo el vigente. Si otro worker pasó a ser el dueño, esta corrida no marca nada.
 */
export async function convertirGrabacion(deps: DepsConvertir, id: string, lockAt: Date): Promise<void> {
  const { repo } = deps;
  const log = deps.registrar ?? ((m: string) => console.log(`[digitalizacion] ${m}`));
  let dir: string | null = null;
  let claveFinal: string | null = null;
  // Desde que la grabación quedó LISTA, nada de lo que falle puede tocar el video final.
  let lista = false;
  let lock = lockAt;
  // Otro worker es ahora el dueño: no se marca nada ni se borran las partes crudas.
  let perdida = false;
  // El video ya está entero en R2 pero la base no confirmó: se lo deja y recuperarTrabadas reencola.
  let subido = false;
  try {
    const datos = await repo.cargar(id);
    if (!datos) throw new CausaError("La grabación no existe.");

    const plan = armarPlan(datos.grabacion, datos.partes);
    if (plan.tipo === "SIN_IMAGEN") {
      const n = await conReintentos(deps, "marcarSinImagen", () => repo.marcarSinImagen(id, lock));
      if (n === 0) {
        log(`${id}: ya no somos dueños, no se marca SIN_IMAGEN`);
        return;
      }
      // Las partes crudas de una grabación sin imagen no se usan nunca.
      try {
        await deps.borrarPrefijo(`digitalizacion/${datos.workspaceId}/${id}/t`);
        await conReintentos(deps, "marcarPartesBorradasSinImagen", () => repo.marcarPartesBorradasSinImagen(id));
      } catch (e) {
        console.error(`[digitalizacion] ${id}: SIN_IMAGEN, falló la limpieza de partes:`, e);
      }
      return;
    }
    if (plan.tipo === "SIN_PARTES") {
      await conReintentos(deps, "marcarError", () => repo.marcarError(id, lock, mensajeError("No hay partes subidas.")));
      return;
    }

    const prefijo = `digitalizacion/${datos.workspaceId}/${id}/`;
    claveFinal = `${prefijo}final.mp4`;

    dir = await fs.promises.mkdtemp(path.join(deps.tmpBase ?? os.tmpdir(), "digi-"));
    const rutaMarca = path.join(dir, "marca.png");
    const brand: BrandingMarca = datos.branding;
    await fs.promises.writeFile(rutaMarca, await armarMarca(brand, deps.cargarLogo));

    // Entrada i = descriptor 3+i del hijo.
    const entradas = plan.entradas.map((_, i) => `pipe:${3 + i}`);
    const args = argumentosFfmpeg(plan, entradas, rutaMarca, deps.preset);
    const ff = spawn(deps.ffmpegPath ?? "ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe", ...plan.entradas.map(() => "pipe" as const)],
    });

    deps.alLanzar?.(ff);
    const entradasVigiladas = plan.entradas.map((_, i) => vigilarEntrada(ff.stdio[3 + i] as Writable));

    let falla: Error | null = null;
    let abortado = false;
    let cancelarSubida!: (e: Error) => void;
    const cortarSubida = new AbortController();
    const cancelacion = new Promise<never>((_, rej) => (cancelarSubida = rej));
    cancelacion.catch(() => {});
    const abortar = (e: Error) => {
      if (!falla) falla = e;
      abortado = true;
      ff.kill("SIGKILL");
      cortarSubida.abort();
      cancelarSubida(e);
    };

    const ultimasLineas: string[] = [];
    let ultimaTime: string | null = null;
    let ultimoProgreso = Date.now();
    let resto = "";
    ff.stderr!.on("data", (chunk: Buffer) => {
      const partes = (resto + chunk.toString("utf8")).split(/[\r\n]+/);
      resto = partes.pop() ?? "";
      for (const linea of partes) {
        if (!linea.trim()) continue;
        ultimasLineas.push(linea);
        if (ultimasLineas.length > 20) ultimasLineas.shift();
        const m = linea.match(/time=(\d+:\d+:\d+(?:\.\d+)?)/);
        if (m) {
          ultimaTime = m[1];
          ultimoProgreso = Date.now();
        }
      }
    });
    // La subida también cuenta como actividad.
    ff.stdout!.on("data", () => (ultimoProgreso = Date.now()));
    const inactividadMs = deps.inactividadMs ?? 10 * 60_000;
    // Renueva el token de bloqueo: sin esto, una conversión larga parecería trabada a los 6 h.
    let renovando = false;
    const renovador = setInterval(() => {
      if (renovando || abortado) return;
      renovando = true;
      void (async () => {
        try {
          let nuevo = new Date();
          if (nuevo.getTime() <= lock.getTime()) nuevo = new Date(lock.getTime() + 1);
          const viejo = lock;
          const n = await conReintentos(deps, "renovarLock", () => repo.renovarLock(id, viejo, nuevo));
          if (n === 0) {
            perdida = true;
            abortar(new CausaError("Se perdió la propiedad de la conversión."));
          } else {
            lock = nuevo;
          }
        } catch (e) {
          // La base no responde: seguimos; el token vence recién a las 6 h.
          console.error(`[digitalizacion] ${id}: no se pudo renovar el bloqueo:`, e);
        } finally {
          renovando = false;
        }
      })();
    }, deps.renovarMs ?? 5 * 60_000);
    // El vigía sigue vivo hasta que termina la subida: una parte multiparte colgada no cuelga el job.
    const vigia = setInterval(() => {
      if (Date.now() - ultimoProgreso > inactividadMs) {
        abortar(new CausaError(`ffmpeg o la subida sin progreso durante ${Math.round(inactividadMs / 60_000)} minutos.`));
      }
    }, Math.min(30_000, Math.max(100, inactividadMs / 4)));

    try {
      const salida = new Promise<number | null>((resolve, reject) => {
        ff.once("error", reject);
        ff.once("close", (code) => resolve(code));
      });
      salida.catch(() => {});

      const terminados = plan.entradas.map((e, i) =>
        alimentar(entradasVigiladas[i], e.claves, deps, () => abortado).catch((err: Error) => {
          if (!abortado) abortar(err); // falló la lectura de R2
        }),
      );
      const escritoresListos = Promise.allSettled(terminados);

      const subida = Promise.race([deps.subirStream(claveFinal, ff.stdout!, cortarSubida.signal), cancelacion]).then(
        (b) => b,
        (err: Error) => {
          abortar(err);
          return 0;
        },
      );

      let codigo: number | null;
      try {
        codigo = await salida;
      } catch (e) {
        abortar(e as Error);
        codigo = null;
      }
      ultimoProgreso = Date.now(); // desde acá sólo falta terminar la subida
      await escritoresListos;
      const bytes = await subida;

      if (perdida) throw new CausaError("Se perdió la propiedad de la conversión.");
      if (falla || codigo !== 0) {
        const detalle = ultimasLineas.join(" | ");
        const causa = falla
          ? (falla as Error).message
          : `ffmpeg terminó con código ${codigo}.`;
        throw new CausaError(causa, detalle);
      }
      if (bytes <= 0) throw new CausaError("La subida del video terminó vacía.");

      const duracion = ultimaTime ? Math.round(aSegundos(ultimaTime)) : 0;
      log(`subido ${claveFinal} ${bytes} bytes, ${duracion}s`);
      subido = true;
      // Sin renovaciones en vuelo mientras se cierra: el token tiene que ser estable.
      clearInterval(renovador);
      while (renovando) await new Promise((r) => setTimeout(r, 20));
      if (perdida) throw new CausaError("Se perdió la propiedad de la conversión.");
      const n = await conReintentos(deps, "marcarLista", () =>
        repo.marcarLista(id, lock, { videoKey: claveFinal!, videoBytes: bytes, videoDuracionSeg: duracion }),
      );
      if (n === 0) {
        perdida = true;
        throw new CausaError("Se perdió la propiedad de la conversión.");
      }
      lista = true;
    } finally {
      clearInterval(vigia);
      clearInterval(renovador);
    }

    // Sólo ahora, con el video subido y la base actualizada, se borran los pedacitos.
    // Si esto falla, el video ya está listo: se registra y queda partesBorradasAt en null.
    try {
      await deps.borrarPrefijo(`${prefijo}t`);
      await conReintentos(deps, "marcarPartesBorradas", () => repo.marcarPartesBorradas(id, claveFinal!));
    } catch (e) {
      console.error(`[digitalizacion] ${id}: el video quedó LISTA pero falló la limpieza de partes:`, e);
    }
  } catch (e) {
    if (lista) {
      console.error(`[digitalizacion] ${id}: error después de LISTA, se conserva el video:`, e);
      return;
    }
    const causa = e instanceof Error ? e.message : String(e);
    const detalle = e instanceof CausaError ? e.detalle : "";
    if (detalle) console.error(`[digitalizacion] ${id}: ${causa} — detalle de ffmpeg: ${detalle.slice(-1500)}`);
    if (subido && !perdida) {
      // La subida terminó y sólo falló la base: no se toca el video; recuperarTrabadas reencola.
      console.error(`[digitalizacion] ${id}: video subido pero la base no confirmó; queda PROCESANDO:`, e);
      return;
    }
    if (claveFinal) {
      // Nunca se borra el video si otro worker ya dejó la grabación LISTA.
      try {
        if ((await repo.estado(id)) !== "LISTA") await deps.borrarPrefijo(claveFinal);
      } catch {
        /* sin certeza del estado, no se borra */
      }
    }
    if (perdida) {
      console.error(`[digitalizacion] ${id}: otro worker es el dueño, no se marca nada:`, causa);
      return;
    }
    try {
      const n = await conReintentos(deps, "marcarError", () => repo.marcarError(id, lock, mensajeError(causa)));
      if (n === 0) console.error(`[digitalizacion] ${id}: ya no somos dueños, no se marcó ERROR`);
    } catch (e2) {
      console.error(`[digitalizacion] ${id}: no se pudo marcar ERROR:`, e2);
    }
  } finally {
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

class CausaError extends Error {
  constructor(
    mensaje: string,
    public detalle = "",
  ) {
    super(mensaje);
  }
}
