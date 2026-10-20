import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { MAX_INTENTOS } from "./cola";
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
      const buf = await deps.leerParte(clave);
      if (abortado() || e.ido) break;
      if (!(await escribirTodo(e, buf))) break;
    }
  } finally {
    if (!e.ws.destroyed) e.ws.end();
  }
}

/** La causa legible va siempre al principio; el detalle de ffmpeg, sólo su cola. */
export function mensajeError(causa: string, detalle: string, intentos: number): string {
  const c = causa.replace(/\s+/g, " ").trim().slice(0, 200);
  const d = detalle.replace(/\s+/g, " ").trim().slice(-600);
  const texto = d ? `${c} — ${d}` : c;
  return intentos >= MAX_INTENTOS ? `${texto} (último intento)` : texto;
}

export async function convertirGrabacion(deps: DepsConvertir, id: string): Promise<void> {
  const { repo } = deps;
  const log = deps.registrar ?? ((m: string) => console.log(`[digitalizacion] ${m}`));
  let intentos = 1;
  let dir: string | null = null;
  let claveFinal: string | null = null;
  // Desde que la grabación quedó LISTA, nada de lo que falle puede tocar el video final.
  let lista = false;
  try {
    const datos = await repo.cargar(id);
    if (!datos) throw new CausaError("La grabación no existe.");
    intentos = datos.intentos;

    const plan = armarPlan(datos.grabacion, datos.partes);
    if (plan.tipo === "SIN_IMAGEN") {
      await repo.marcarSinImagen(id);
      return;
    }
    if (plan.tipo === "SIN_PARTES") {
      await repo.marcarError(id, mensajeError("No hay partes subidas.", "", intentos));
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
      await repo.marcarLista(id, { videoKey: claveFinal, videoBytes: bytes, videoDuracionSeg: duracion });
      lista = true;
    } finally {
      clearInterval(vigia);
    }

    // Sólo ahora, con el video subido y la base actualizada, se borran los pedacitos.
    // Si esto falla, el video ya está listo: se registra y queda partesBorradasAt en null.
    try {
      await deps.borrarPrefijo(`${prefijo}t`);
      await repo.marcarPartesBorradas(id);
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
    if (claveFinal) await deps.borrarPrefijo(claveFinal).catch(() => {});
    try {
      await repo.marcarError(id, mensajeError(causa, detalle, intentos));
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
