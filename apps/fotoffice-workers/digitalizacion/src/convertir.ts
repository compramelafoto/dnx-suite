import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import { MAX_INTENTOS } from "./cola";
import { armarMarca, type BrandingMarca } from "./marca";
import { argumentosFfmpeg, armarPlan } from "./plan";
import type { Repo } from "./repo";

const execFileP = promisify(execFile);

export type DepsConvertir = {
  repo: Repo;
  leerParte(clave: string): Promise<Buffer>;
  subirStream(clave: string, stream: Readable): Promise<number>;
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
};

function aSegundos(hms: string): number {
  const [h, m, s] = hms.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function dormir(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Abre cada FIFO para lectura sin bloquear, así un escritor que espera un lector se libera. */
function destrabar(fifos: string[]) {
  for (const f of fifos) {
    try {
      const fd = fs.openSync(f, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
      fs.closeSync(fd);
    } catch {
      /* ya no existe o ya tiene lector */
    }
  }
}

function escribirTodo(ws: fs.WriteStream, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (e: Error) => reject(e);
    ws.once("error", onError);
    const ok = ws.write(buf, (err) => {
      if (err) reject(err);
    });
    if (ok) {
      ws.off("error", onError);
      resolve();
    } else {
      ws.once("drain", () => {
        ws.off("error", onError);
        resolve();
      });
    }
  });
}

async function alimentarFifo(
  fifo: string,
  claves: string[],
  deps: DepsConvertir,
  abortado: () => boolean,
): Promise<void> {
  const ws = fs.createWriteStream(fifo, { flags: "w" });
  const cerrado = new Promise<void>((resolve, reject) => {
    ws.once("close", () => resolve());
    ws.once("error", reject);
  });
  cerrado.catch(() => {});
  try {
    for (const clave of claves) {
      if (abortado()) break;
      const buf = await deps.leerParte(clave);
      if (abortado()) break;
      await escribirTodo(ws, buf);
    }
  } finally {
    ws.end();
  }
  await cerrado;
}

function mensajeError(texto: string, intentos: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim().slice(-800);
  return intentos >= MAX_INTENTOS ? `${limpio} (último intento)` : limpio;
}

export async function convertirGrabacion(deps: DepsConvertir, id: string): Promise<void> {
  const { repo } = deps;
  const log = deps.registrar ?? (() => {});
  let intentos = 1;
  let dir: string | null = null;
  let claveFinal: string | null = null;
  try {
    const datos = await repo.cargar(id);
    if (!datos) throw new Error("La grabación no existe.");
    intentos = datos.intentos;

    const plan = armarPlan(datos.grabacion, datos.partes);
    if (plan.tipo === "SIN_IMAGEN") {
      await repo.marcarSinImagen(id);
      return;
    }
    if (plan.tipo === "SIN_PARTES") {
      await repo.marcarError(id, mensajeError("No hay partes subidas.", intentos));
      return;
    }

    const prefijo = `digitalizacion/${datos.workspaceId}/${id}/`;
    claveFinal = `${prefijo}final.mp4`;

    dir = await fs.promises.mkdtemp(path.join(deps.tmpBase ?? os.tmpdir(), "digi-"));
    const fifos = plan.entradas.map((_, i) => path.join(dir!, `entrada${i}.fifo`));
    for (const f of fifos) await execFileP("mkfifo", [f]);

    const rutaMarca = path.join(dir, "marca.png");
    const brand: BrandingMarca = datos.branding;
    await fs.promises.writeFile(rutaMarca, await armarMarca(brand, deps.cargarLogo));

    const args = argumentosFfmpeg(plan, fifos, rutaMarca, deps.preset);
    const ff = spawn(deps.ffmpegPath ?? "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    let falla: Error | null = null;
    let abortado = false;
    const abortar = (e: Error) => {
      if (!falla) falla = e;
      abortado = true;
      ff.kill("SIGKILL");
    };

    const ultimasLineas: string[] = [];
    let ultimaTime: string | null = null;
    let ultimoProgreso = Date.now();
    let resto = "";
    ff.stderr.on("data", (chunk: Buffer) => {
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
    const inactividadMs = deps.inactividadMs ?? 10 * 60_000;
    const vigia = setInterval(() => {
      if (Date.now() - ultimoProgreso > inactividadMs) {
        abortar(new Error(`ffmpeg sin progreso durante ${Math.round(inactividadMs / 60_000)} minutos.`));
      }
    }, Math.min(30_000, Math.max(100, inactividadMs / 4)));

    const salida = new Promise<number | null>((resolve, reject) => {
      ff.once("error", reject);
      ff.once("close", (code) => resolve(code));
    });
    salida.catch(() => {});

    const escritores = plan.entradas.map((e, i) =>
      alimentarFifo(fifos[i], e.claves, deps, () => abortado).catch((err: Error) => {
        // EPIPE cuando ffmpeg ya terminó o murió: el error real es el de ffmpeg.
        if (!abortado && (err as NodeJS.ErrnoException).code !== "EPIPE") abortar(err);
      }),
    );
    const escritoresListos = Promise.allSettled(escritores);
    let escritoresTerminaron = false;
    void escritoresListos.then(() => (escritoresTerminaron = true));

    const subida = deps.subirStream(claveFinal, ff.stdout).then(
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
    clearInterval(vigia);
    // Si ffmpeg terminó antes de abrir algún FIFO, liberar a los escritores bloqueados.
    while (!escritoresTerminaron) {
      destrabar(fifos);
      await Promise.race([escritoresListos, dormir(100)]);
    }
    const bytes = await subida;

    if (falla || codigo !== 0) {
      const detalle = ultimasLineas.join(" | ");
      const base = falla
        ? `${(falla as Error).message}${detalle ? ` — ${detalle}` : ""}`
        : `ffmpeg terminó con código ${codigo}: ${detalle}`;
      throw new Error(base);
    }
    if (bytes <= 0) throw new Error("La subida del video terminó vacía.");

    const duracion = ultimaTime ? Math.round(aSegundos(ultimaTime)) : 0;
    log(`subido ${claveFinal} ${bytes} bytes, ${duracion}s`);
    await repo.marcarLista(id, { videoKey: claveFinal, videoBytes: bytes, videoDuracionSeg: duracion });
    // Sólo ahora, con el video subido y la base actualizada, se borran los pedacitos.
    await deps.borrarPrefijo(`${prefijo}t`);
    await repo.marcarPartesBorradas(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (claveFinal) await deps.borrarPrefijo(claveFinal).catch(() => {});
    await repo.marcarError(id, mensajeError(msg, intentos));
  } finally {
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
