/**
 * Prueba real de grabaciones SIN pista de audio con el ffmpeg/ffprobe del sistema (en la imagen:
 * ffmpeg 5.1 de Debian). Sin base ni R2: genera los medios, los parte como MediaRecorder, corre la
 * detección real (ffprobe sobre el comienzo de la 1.ª parte), `armarPlan` + `argumentosFfmpeg`, y
 * pasa cada tramo por `pipe:N` como el worker. Verifica con ffprobe que la salida tenga video y
 * audio y que las duraciones coincidan (±0,1 s). Sale con código 1 si algo falla.
 * Uso: pnpm tsx scripts/prueba-sin-audio.ts   (todo queda en os.tmpdir() y se borra al final)
 */

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Writable } from "node:stream";
import { detectarAudio, sondearConFfprobe } from "../src/audio";
import { argumentosFfmpeg, armarPlan, conAudio, type GrabacionParaPlan, type ParteR2 } from "../src/plan";

const run = promisify(execFile);
const TROZO = 1_200_000;
const TOLERANCIA = 0.1;

let fallos = 0;
function chequear(ok: boolean, msg: string) {
  console.log(`${ok ? "OK   " : "FALLA"} ${msg}`);
  if (!ok) fallos++;
}

async function generar(args: string[]) {
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
}

const base: GrabacionParaPlan = {
  tipo: "VHS",
  corregirProporcion: false,
  sinImagen: false,
  primeraImagenSeg: null,
  ultimaImagenSeg: null,
  ultimaImagenTramo: null,
};

type Medio = { archivo: string; seg: number; audio: boolean };

/** Fin del último paquete de un tipo de pista (más fiel que la duración del contenedor). */
async function finPista(archivo: string, sel: "v" | "a"): Promise<number | null> {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-select_streams", sel, "-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0", archivo],
    { maxBuffer: 1 << 26 },
  );
  let fin: number | null = null;
  for (const l of stdout.trim().split("\n")) {
    const [p, d] = l.split(",").map(Number);
    if (Number.isFinite(p)) fin = Math.max(fin ?? 0, p + (Number.isFinite(d) ? d : 0));
  }
  return fin;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "digi-sin-audio-"));
  try {
    const { stdout: version } = await run("ffmpeg", ["-version"]);
    console.log(version.split("\n")[0]);

    const marca = path.join(dir, "marca.png");
    await generar(["-f", "lavfi", "-i", "color=red:s=200x60", "-frames:v", "1", marca]);

    const m = (n: string) => path.join(dir, n);
    const mudo5: Medio = { archivo: m("mudo5.webm"), seg: 5, audio: false };
    const mudo7: Medio = { archivo: m("mudo7.webm"), seg: 7, audio: false };
    const sonido6: Medio = { archivo: m("sonido6.webm"), seg: 6, audio: true };
    const dvdMudo: Medio = { archivo: m("mudo.vob"), seg: 6, audio: false };
    const vp8 = ["-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime"];
    await generar(["-f", "lavfi", "-i", "testsrc=s=720x480:r=30000/1001:d=5", ...vp8, mudo5.archivo]);
    await generar(["-f", "lavfi", "-i", "testsrc2=s=720x480:r=30000/1001:d=7", ...vp8, mudo7.archivo]);
    await generar([
      "-f", "lavfi", "-i", "testsrc=s=720x480:r=30000/1001:d=6",
      "-f", "lavfi", "-i", "sine=f=440:r=48000:d=6", ...vp8, "-c:a", "libopus", sonido6.archivo,
    ]);
    await generar(["-f", "lavfi", "-i", "testsrc=s=720x480:r=25:d=6", "-c:v", "mpeg2video", "-f", "vob", dvdMudo.archivo]);

    const sondear = sondearConFfprobe();
    const registrar = (msg: string) => console.log(`      ${msg}`);

    async function caso(nombre: string, g: GrabacionParaPlan, medios: Medio[]) {
      // Partes como las sube la estación: un stream cortado en trozos de bytes.
      const esDvd = g.tipo === "DVD";
      const contenido = new Map<string, Buffer>();
      const partes: ParteR2[] = [];
      medios.forEach((me, i) => {
        const buf = fs.readFileSync(me.archivo);
        for (let j = 0, off = 0; off < buf.length; j++, off += TROZO) {
          const tramo = esDvd ? 1 : i + 1;
          const indice = esDvd ? partes.length : j;
          const key = `t${tramo}/${String(indice).padStart(5, "0")}`;
          contenido.set(key, buf.subarray(off, off + TROZO));
          partes.push({ tramo, indice, key });
        }
      });
      const plan0 = armarPlan(g, partes);
      if (plan0.tipo !== "CONVERTIR") throw new Error(`${nombre}: plan ${plan0.tipo}`);
      const leerInicio = async (k: string, n: number) => contenido.get(k)!.subarray(0, n);
      const audios = await Promise.all(plan0.entradas.map((e) => detectarAudio(e.claves[0], { leerInicio, sondear, registrar })));
      const esperados = esDvd ? [medios.some((x) => x.audio)] : medios.map((x) => x.audio);
      chequear(JSON.stringify(audios) === JSON.stringify(esperados), `${nombre}: audio detectado ${JSON.stringify(audios)}`);
      const plan = conAudio(plan0, audios);

      const salida = path.join(dir, `${nombre}.mp4`);
      const args = argumentosFfmpeg(plan, plan.entradas.map((_, i) => `pipe:${3 + i}`), marca, "ultrafast");
      const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe", ...plan.entradas.map(() => "pipe" as const)] });
      const ws = fs.createWriteStream(salida);
      const escrito = new Promise<void>((r, rej) => ws.on("finish", r).on("error", rej));
      ff.stdout!.pipe(ws);
      let err = "";
      ff.stderr!.on("data", (c: Buffer) => (err = (err + c.toString()).slice(-3000)));
      const fin = new Promise<number | null>((r, rej) => ff.once("close", r).once("error", rej));
      plan.entradas.forEach((e, i) => {
        const s = ff.stdio[3 + i] as Writable;
        s.on("error", () => {});
        void (async () => {
          for (const k of e.claves) {
            if (!s.write(contenido.get(k)!)) await new Promise((r) => s.once("drain", r));
          }
          s.end();
        })();
      });
      const codigo = await fin;
      await escrito;
      if (codigo !== 0) {
        chequear(false, `${nombre}: ffmpeg terminó con código ${codigo}: ${err.replace(/\s+/g, " ").slice(-600)}`);
        return;
      }
      const v = await finPista(salida, "v");
      const a = await finPista(salida, "a");
      const total = medios.reduce((s, x) => s + x.seg, 0);
      chequear(v != null, `${nombre}: tiene video (${v?.toFixed(3)} s)`);
      chequear(a != null, `${nombre}: tiene audio (${a?.toFixed(3)} s)`);
      if (v != null && a != null) {
        chequear(Math.abs(a - v) <= TOLERANCIA, `${nombre}: audio − video = ${(a - v).toFixed(3)} s (±${TOLERANCIA})`);
        chequear(Math.abs(v - total) <= TOLERANCIA, `${nombre}: video ${v.toFixed(3)} s vs. tramos ${total} s (±${TOLERANCIA})`);
      }
    }

    await caso("a-dos-tramos-mudos", base, [mudo5, mudo7]);
    await caso("b-mixto-sonido-mudo", base, [sonido6, mudo7]);
    await caso("b-mixto-mudo-sonido", base, [mudo5, sonido6]);
    await caso("c-dvd-mudo", { ...base, tipo: "DVD" }, [dvdMudo]);
    await caso("d-con-audio", base, [sonido6]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(fallos === 0 ? "\nTodo OK" : `\n${fallos} FALLAS`);
  if (fallos > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
