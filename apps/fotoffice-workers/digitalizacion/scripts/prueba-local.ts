/**
 * Prueba real local de la conversión: genera medios con ffmpeg, los parte como MediaRecorder,
 * corre `convertirGrabacion` con R2 y base falsos y verifica el resultado con ffprobe.
 * Uso: pnpm tsx scripts/prueba-local.ts   (todo queda en os.tmpdir())
 */
process.env.UV_THREADPOOL_SIZE ??= "16";

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { convertirGrabacion } from "../src/convertir";
import type { DatosGrabacion, Repo } from "../src/repo";

const run = promisify(execFile);
const FF = "ffmpeg";
const TROZO = 1_200_000;

let fallos = 0;
function chequear(ok: boolean, msg: string) {
  console.log(`${ok ? "OK   " : "FALLA"} ${msg}`);
  if (!ok) fallos++;
}

async function generar(args: string[]) {
  await run(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
}

/** Parte un archivo en trozos de bytes (como MediaRecorder: un solo stream cortado). */
function partir(archivo: string, carpeta: string, tramo: number, ext = "part") {
  const buf = fs.readFileSync(archivo);
  const out: { tramo: number; indice: number; key: string; path: string }[] = [];
  for (let i = 0, off = 0; off < buf.length; i++, off += TROZO) {
    const key = `digitalizacion/ws1/g1/t${tramo}/${String(i).padStart(5, "0")}.${ext}`;
    const p = path.join(carpeta, `t${tramo}-${i}.${ext}`);
    fs.writeFileSync(p, buf.subarray(off, off + TROZO));
    out.push({ tramo, indice: i, key, path: p });
  }
  return out;
}

async function probe(archivo: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", archivo]);
  const j = JSON.parse(stdout);
  const v = j.streams.find((s: any) => s.codec_type === "video");
  const a = j.streams.find((s: any) => s.codec_type === "audio");
  const [n, d] = String(v.avg_frame_rate).split("/").map(Number);
  return {
    ancho: v.width as number,
    alto: v.height as number,
    fps: n / d,
    vcodec: v.codec_name as string,
    vperfil: v.profile as string,
    acodec: a?.codec_name as string,
    arate: Number(a?.sample_rate),
    duracion: Number(j.format.duration),
  };
}

async function esquina(video: string, seg: number, salida: string) {
  // Región de la marca (abajo a la derecha), como RGB crudo.
  const { stdout } = await run(
    FF,
    ["-v", "error", "-ss", String(seg), "-i", video, "-frames:v", "1", "-vf", "crop=440:200:1440:840", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { encoding: "buffer", maxBuffer: 1 << 26 },
  );
  await generar(["-ss", String(seg), "-i", video, "-frames:v", "1", salida]);
  return stdout as unknown as Buffer;
}

function verdes(b: Buffer): number {
  let n = 0;
  for (let i = 0; i + 2 < b.length; i += 3) {
    if (b[i] < 90 && b[i + 1] > 170 && b[i + 2] < 140) n++;
  }
  return n;
}
function diferencia(a: Buffer, b: Buffer): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

type Caso = {
  nombre: string;
  tipo: "VHS" | "DVD";
  grab: DatosGrabacion["grabacion"];
  partes: { tramo: number; indice: number; key: string; path: string }[];
  esperadaSeg: number;
  verificarMarca: boolean;
  verificarBarras?: boolean;
};

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "digi-prueba-"));
  console.log("Carpeta de trabajo:", dir);

  console.log("Generando medios de prueba...");
  const audio = ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"];
  await generar(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", ...audio, "-t", "90", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1M", "-c:a", "libopus", path.join(dir, "t1.webm")]);
  await generar(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", ...audio, "-t", "30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1M", "-c:a", "libopus", path.join(dir, "t2.webm")]);
  await generar(["-f", "lavfi", "-i", "testsrc2=size=720x480:rate=30000/1001", ...audio, "-t", "40", "-c:v", "mpeg2video", "-b:v", "4M", "-flags", "+ilme+ildct", "-aspect", "4:3", "-c:a", "ac3", "-f", "vob", path.join(dir, "dvd.vob")]);

  const t1 = partir(path.join(dir, "t1.webm"), dir, 1);
  const t2 = partir(path.join(dir, "t2.webm"), dir, 2);
  const dvd = partir(path.join(dir, "dvd.vob"), dir, 1, "vob");
  console.log(`Pedacitos: tramo1=${t1.length}, tramo2=${t2.length}, dvd=${dvd.length}`);

  const vhs = { tipo: "VHS", corregirProporcion: false, sinImagen: false } as const;
  const casos: Caso[] = [
    {
      nombre: "VHS 2 tramos, no estirada, primera=20 ultima=15 (tramo 2)",
      tipo: "VHS",
      grab: { ...vhs, tipo: "VHS", primeraImagenSeg: 20, ultimaImagenSeg: 15, ultimaImagenTramo: 2 },
      partes: [...t2, ...t1], // desordenadas a propósito
      esperadaSeg: 90 - 15 + 20,
      verificarMarca: true,
    },
    {
      nombre: "VHS 1 tramo, estirada, primera=10 ultima=80",
      tipo: "VHS",
      grab: { ...vhs, tipo: "VHS", corregirProporcion: true, primeraImagenSeg: 10, ultimaImagenSeg: 80, ultimaImagenTramo: 1 },
      partes: t1,
      esperadaSeg: 80,
      verificarMarca: true,
      verificarBarras: true,
    },
    {
      nombre: "DVD 720x480 4:3 entrelazado",
      tipo: "DVD",
      grab: { ...vhs, tipo: "DVD", primeraImagenSeg: null, ultimaImagenSeg: null, ultimaImagenTramo: null },
      partes: dvd,
      esperadaSeg: 40,
      verificarMarca: false,
    },
  ];

  const logo = await sharp({ create: { width: 500, height: 160, channels: 4, background: { r: 255, g: 140, b: 0, alpha: 1 } } }).png().toBuffer();
  let maxRss = 0;
  const rssTimer = setInterval(() => (maxRss = Math.max(maxRss, process.memoryUsage().rss)), 200);

  for (const [n, caso] of casos.entries()) {
    console.log(`\n=== Caso ${n + 1}: ${caso.nombre} ===`);
    const mapa = new Map(caso.partes.map((p) => [p.key, p.path]));
    const final = path.join(dir, `salida-${n + 1}.mp4`);
    const estado: Record<string, unknown> = {};
    const borrados: string[] = [];
    const orden: string[] = [];
    const repo: Repo = {
      async cargar() {
        return {
          id: "g1",
          workspaceId: "ws1",
          intentos: 1,
          grabacion: caso.grab,
          partes: caso.partes.map(({ tramo, indice, key }) => ({ tramo, indice, key })),
          branding: { commercialName: "Estudio Prueba", logoUrl: "http://logo/x.png", whatsapp: "+54 9 11 5555-5555" },
        };
      },
      async marcarSinImagen() { estado.estado = "SIN_IMAGEN"; },
      async marcarError(_id, m) { estado.estado = "ERROR"; estado.error = m; },
      async marcarLista(_id, d) { estado.estado = "LISTA"; Object.assign(estado, d); orden.push("lista"); },
      async marcarPartesBorradas() { orden.push("partesBorradas"); },
    };
    const t0 = Date.now();
    await convertirGrabacion(
      {
        repo,
        preset: "veryfast",
        cargarLogo: async () => logo,
        leerParte: async (k) => fs.promises.readFile(mapa.get(k)!),
        subirStream: async (_k, stream) => {
          const ws = fs.createWriteStream(final);
          await new Promise<void>((res, rej) => {
            stream.pipe(ws);
            ws.on("finish", () => res());
            ws.on("error", rej);
            stream.on("error", rej);
          });
          return fs.statSync(final).size;
        },
        borrarPrefijo: async (p) => { borrados.push(p); orden.push("borrar"); },
      },
      "g1",
    );
    console.log(`Convertido en ${((Date.now() - t0) / 1000).toFixed(1)} s; estado=`, JSON.stringify(estado));
    chequear(estado.estado === "LISTA", `estado LISTA${estado.error ? " (" + estado.error + ")" : ""}`);
    if (estado.estado !== "LISTA") continue;
    chequear(orden.join(",") === "lista,borrar,partesBorradas", `orden: ${orden.join(" -> ")}`);
    chequear(borrados[0] === "digitalizacion/ws1/g1/t", `borró el prefijo ${borrados[0]}`);

    const p = await probe(final);
    console.log("ffprobe:", JSON.stringify(p));
    chequear(p.ancho === 1920 && p.alto === 1080, `resolución ${p.ancho}x${p.alto}`);
    chequear(Math.abs(p.fps - 30) < 0.01, `fps ${p.fps}`);
    chequear(p.vcodec === "h264" && p.vperfil === "High", `video ${p.vcodec} ${p.vperfil}`);
    chequear(p.acodec === "aac" && p.arate === 48000, `audio ${p.acodec} ${p.arate} Hz`);
    chequear(Math.abs(p.duracion - caso.esperadaSeg) <= 1, `duración ${p.duracion.toFixed(2)} s (esperada ${caso.esperadaSeg} ± 1)`);
    chequear(Math.abs((estado.videoDuracionSeg as number) - caso.esperadaSeg) <= 2, `videoDuracionSeg guardada = ${estado.videoDuracionSeg}`);

    if (caso.verificarMarca) {
      const a64 = await esquina(final, 64, path.join(dir, `caso${n + 1}-seg64.png`));
      const a70 = await esquina(final, 70, path.join(dir, `caso${n + 1}-seg70.png`));
      const v64 = verdes(a64);
      const v70 = verdes(a70);
      const d = diferencia(a64, a70);
      console.log(`Esquina: píxeles verdes WhatsApp seg64=${v64}, seg70=${v70}; diferencia media=${d.toFixed(1)}`);
      chequear(v64 > 500 && v70 < 50 && d > 5, "marca visible a los 64 s y oculta a los 70 s");
    }
    if (caso.verificarBarras) {
      const { stdout } = await run(FF, ["-v", "error", "-ss", "30", "-i", final, "-frames:v", "1", "-vf", "crop=100:600:0:240", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { encoding: "buffer", maxBuffer: 1 << 26 });
      const b = stdout as unknown as Buffer;
      const maxv = Math.max(...b);
      chequear(maxv <= 20, `barra negra a la izquierda en la versión estirada (máx luma ${maxv})`);
    }
  }
  clearInterval(rssTimer);
  console.log(`\nRSS máximo del proceso Node: ${(maxRss / 1048576).toFixed(0)} MB`);
  console.log(`Capturas y salidas en: ${dir}`);
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} verificaciones fallaron`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
