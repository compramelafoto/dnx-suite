import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { mensajeError } from "./convertir";
import { argumentosRelleno, crearSubidorHls } from "./hls";
import type { RepoRelleno } from "./repo";

/** Tope de lo que puede esperar en /tmp (que en Cloud Run es memoria) antes de frenar la entrada. */
export type LimitesContrapresion = { maxSegmentos: number; maxBytes: number };
export const CONTRAPRESION_POR_DEFECTO: LimitesContrapresion = { maxSegmentos: 20, maxBytes: 60 * 1024 * 1024 };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pasa el `final.mp4` de R2 a ffmpeg con contrapresión: si los segmentos sin subir superan el tope
 * (cantidad o bytes), deja de leer R2 y de escribir en ffmpeg hasta que bajen. ffmpeg, sin
 * entrada, deja de producir segmentos; el lector reanudable de R2 retoma por `Range` si la
 * conexión ociosa se corta. También respeta el `drain` del descriptor de ffmpeg.
 */
export async function bombear(
  fuente: AsyncIterable<Uint8Array>,
  destino: Writable,
  o: {
    pendientes(): Promise<{ cantidad: number; bytes: number; subibles: number }>;
    limites: LimitesContrapresion;
    cortado(): boolean;
    /** Cada cuánto se mira la carpeta mientras fluye (default 250 ms) y mientras está frenado (default 200 ms). */
    mirarCadaMs?: number;
    esperaMs?: number;
    alFrenar?(p: { cantidad: number; bytes: number; subibles: number }): void;
  },
): Promise<void> {
  const mirarCada = o.mirarCadaMs ?? 250;
  const espera = o.esperaMs ?? 200;
  let ultimaMirada = 0;
  // Sólo se frena si el subidor puede vaciar algo: si lo único que hay es el segmento a medio
  // escribir, ffmpeg necesita entrada para cerrarlo y frenar sería trabarse para siempre.
  const lleno = (p: { cantidad: number; bytes: number; subibles: number }) =>
    p.subibles > 0 && (p.cantidad >= o.limites.maxSegmentos || p.bytes >= o.limites.maxBytes);
  for await (const chunk of fuente) {
    if (o.cortado()) return;
    if (Date.now() - ultimaMirada >= mirarCada) {
      let p = await o.pendientes();
      if (lleno(p)) {
        o.alFrenar?.(p);
        while (lleno(p)) {
          await dormir(espera);
          if (o.cortado()) return;
          p = await o.pendientes();
        }
      }
      ultimaMirada = Date.now();
    }
    if (o.cortado() || destino.destroyed || destino.writableEnded) return;
    if (!destino.write(chunk)) {
      await new Promise<void>((resolve) => {
        const listo = () => {
          destino.off("drain", listo);
          destino.off("close", listo);
          destino.off("error", listo);
          resolve();
        };
        destino.on("drain", listo);
        destino.on("close", listo);
        destino.on("error", listo);
      });
    }
  }
  if (!destino.destroyed && !destino.writableEnded) destino.end();
}

export type DepsRelleno = {
  repo: RepoRelleno;
  leerStream(clave: string): Readable;
  subirArchivo(clave: string, cuerpo: Buffer, tipo: string): Promise<void>;
  borrarPrefijo(prefijo: string): Promise<void>;
  ffmpegPath?: string;
  /** Cada cuánto se renueva el token de bloqueo (default 5 min). */
  renovarMs?: number;
  /** Sin progreso de ffmpeg durante este tiempo, se lo mata. Default 10 min. */
  inactividadMs?: number;
  tmpBase?: string;
  registrar?: (msg: string) => void;
  hlsIntervaloMs?: number;
  hlsEsperasMs?: number[];
  /** Default 20 segmentos o 60 MB esperando subir. */
  contrapresion?: LimitesContrapresion;
  /** Preset de x264 del 720p (default `PRESET_HLS`). */
  presetHls?: string;
};

/**
 * Relleno (E10): arma la versión para mirar de una grabación LISTA que no la tiene, leyendo su
 * `final.mp4` de R2 en streaming (sin bajarlo al disco). `lockAt` es el token que devolvió
 * `tomarRelleno`; toda escritura exige que siga vigente. El MP4 nunca se toca: si algo falla,
 * se borra lo subido del HLS y se anota el intento.
 *
 * Cada intento escribe en su propia carpeta `hls-<lockAt en ms>`. Al empezar se borran las
 * carpetas `hls*` de intentos anteriores (ya no son de nadie: el bloqueo es nuestro); si este
 * intento falla, se borra sólo la suya. `hlsKey` apunta a la carpeta del intento que terminó.
 */
export async function rellenarHls(deps: DepsRelleno, id: string, lockAt: Date): Promise<void> {
  const { repo } = deps;
  const log = deps.registrar ?? ((m: string) => console.log(`[digitalizacion][relleno] ${m}`));
  let lock = lockAt;
  let perdida = false;
  let prefijoHls: string | null = null;
  let dir: string | null = null;
  try {
    const datos = await repo.cargarRelleno(id);
    if (!datos) return;
    const prefijo = `digitalizacion/${datos.workspaceId}/${id}/`;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(datos.workspaceId) || datos.videoKey !== `${prefijo}final.mp4`) {
      throw new Error("La grabación no tiene un final.mp4 con la clave esperada.");
    }
    // Restos de intentos anteriores (`hls`, `hls-<ms>`…): se empieza de cero.
    await deps.borrarPrefijo(`${prefijo}hls`);
    prefijoHls = `${prefijo}hls-${lockAt.getTime()}`;

    dir = await fs.promises.mkdtemp(path.join(deps.tmpBase ?? os.tmpdir(), "digi-hls-"));
    const subidor = crearSubidorHls({
      dir,
      prefijoHls,
      subirArchivo: deps.subirArchivo,
      intervaloMs: deps.hlsIntervaloMs,
      esperasMs: deps.hlsEsperasMs,
      registrar: (m) => log(`${id}: ${m}`),
    });

    const ff = spawn(deps.ffmpegPath ?? "ffmpeg", argumentosRelleno("pipe:3", dir, deps.presetHls), {
      stdio: ["ignore", "ignore", "pipe", "pipe"],
    });
    subidor.iniciar();

    let falla: Error | null = null;
    let abortado = false;
    let ffTermino = false;
    const abortar = (e: Error) => {
      if (!falla) falla = e;
      abortado = true;
      ff.kill("SIGKILL");
    };

    // Entrada: el final.mp4 por un descriptor. Si ffmpeg se va, el error del socket no es nuestro.
    const entrada = ff.stdio[3] as Writable;
    entrada.on("error", () => {});
    const fuente = deps.leerStream(datos.videoKey);
    fuente.on("error", () => {});
    let frenadas = 0;
    const bomba = bombear(fuente, entrada, {
      pendientes: () => subidor.pendientes(),
      limites: deps.contrapresion ?? CONTRAPRESION_POR_DEFECTO,
      cortado: () => abortado || ffTermino,
      alFrenar: (p) => {
        if (frenadas++ % 20 === 0) log(`${id}: entrada en pausa, ${p.cantidad} segmentos (${Math.round(p.bytes / 1048576)} MB) esperando subir`);
      },
    }).catch((e: Error) => {
      if (!abortado) abortar(new Error(`No se pudo leer el video de R2: ${e.message}`));
    });

    const ultimas: string[] = [];
    let ultimoProgreso = Date.now();
    let resto = "";
    ff.stderr!.on("data", (chunk: Buffer) => {
      const partes = (resto + chunk.toString("utf8")).split(/[\r\n]+/);
      resto = partes.pop() ?? "";
      for (const l of partes) {
        if (!l.trim()) continue;
        ultimas.push(l);
        if (ultimas.length > 20) ultimas.shift();
        if (/time=\d/.test(l)) ultimoProgreso = Date.now();
      }
    });
    const inactividadMs = deps.inactividadMs ?? 10 * 60_000;
    const vigia = setInterval(() => {
      if (Date.now() - ultimoProgreso > inactividadMs) {
        abortar(new Error(`ffmpeg sin progreso durante ${Math.round(inactividadMs / 60_000)} minutos.`));
      }
    }, Math.min(30_000, Math.max(100, inactividadMs / 4)));
    let renovando = false;
    const renovador = setInterval(() => {
      if (renovando || abortado) return;
      renovando = true;
      void (async () => {
        try {
          let nuevo = new Date();
          if (nuevo.getTime() <= lock.getTime()) nuevo = new Date(lock.getTime() + 1);
          const n = await repo.renovarLockRelleno(id, lock, nuevo);
          if (n === 0) {
            perdida = true;
            abortar(new Error("Se perdió la propiedad del relleno."));
          } else {
            lock = nuevo;
          }
        } catch (e) {
          console.error(`[digitalizacion][relleno] ${id}: no se pudo renovar el bloqueo:`, e);
        } finally {
          renovando = false;
        }
      })();
    }, deps.renovarMs ?? 5 * 60_000);

    let ok = false;
    try {
      const codigo = await new Promise<number | null>((resolve) => {
        ff.once("error", (e) => {
          abortar(e);
          resolve(null);
        });
        ff.once("close", (c) => resolve(c));
      });
      // ffmpeg ya terminó: el vigía no tiene nada que vigilar (subir lo último puede tardar).
      clearInterval(vigia);
      ffTermino = true;
      fuente.destroy();
      await bomba;
      if (!falla && codigo !== 0) falla = new Error(`ffmpeg terminó con código ${codigo}.`);
      if (falla) console.error(`[digitalizacion][relleno] ${id}: ${(falla as Error).message} — ${ultimas.join(" | ").slice(-1500)}`);
      ok = await subidor.terminar(!falla);
      if (!falla && !ok) falla = new Error(`La versión para mirar no se pudo publicar: ${subidor.fallo() ?? "sin detalle"}`);
    } finally {
      clearInterval(vigia);
      clearInterval(renovador);
      while (renovando) await new Promise((r) => setTimeout(r, 20));
    }
    if (perdida) throw new Error("Se perdió la propiedad del relleno.");
    if (falla) throw falla;

    const n = await repo.marcarHls(id, lock, prefijoHls);
    if (n === 0) {
      // Se borró el video por vencimiento, o perdimos el bloqueo: lo subido sobra si no es de nadie.
      if ((await repo.estadoHls(id)) !== prefijoHls) await deps.borrarPrefijo(`${prefijoHls}/`).catch(() => {});
      log(`${id}: no se guardó la versión para mirar (la grabación cambió mientras tanto)`);
      return;
    }
    log(`${id}: versión para mirar lista en ${prefijoHls}`);
  } catch (e) {
    const causa = e instanceof Error ? e.message : String(e);
    console.error(`[digitalizacion][relleno] ${id}: falló:`, causa);
    // La carpeta es sólo de este intento: se borra aunque se haya perdido el bloqueo.
    if (prefijoHls) await deps.borrarPrefijo(`${prefijoHls}/`).catch(() => {});
    if (perdida) return;
    try {
      await repo.marcarFalloHls(id, lock, mensajeError(causa));
    } catch (e2) {
      console.error(`[digitalizacion][relleno] ${id}: no se pudo anotar el intento:`, e2);
    }
  } finally {
    if (dir) await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
