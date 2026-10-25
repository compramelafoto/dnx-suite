/**
 * Prueba real local del relleno HLS (E10): genera un `final.mp4` sintético de 30 s 1080p
 * (fragmentado, como el de la conversión), lo pasa a `rellenarHls` por pipe con un R2 falso cuyo
 * subidor es LENTO y mide cuánto llega a acumularse en /tmp. Corre dos veces: con un tope chico de
 * contrapresión y sin tope, para comparar. Verifica el HLS resultante con ffprobe.
 * Uso: pnpm tsx scripts/prueba-relleno.ts   (todo queda en os.tmpdir())
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { rellenarHls, type LimitesContrapresion } from "../src/rellenar";
import type { RepoRelleno } from "../src/repo";

const run = promisify(execFile);
let fallos = 0;
function chequear(ok: boolean, msg: string) {
  console.log(`${ok ? "OK   " : "FALLA"} ${msg}`);
  if (!ok) fallos++;
}

async function correr(base: string, mp4: string, nombre: string, limites: LimitesContrapresion, msPorSegmento: number) {
  const tmpBase = path.join(base, `tmp-${nombre}`);
  fs.mkdirSync(tmpBase);
  const r2 = new Map<string, Buffer>();
  const marcas: string[] = [];
  const repo: RepoRelleno = {
    async cargarRelleno(id) { return { id, workspaceId: "ws1", videoKey: "digitalizacion/ws1/g1/final.mp4" }; },
    async renovarLockRelleno() { return 1; },
    async marcarHls(_i, _l, k) { marcas.push(`hls:${k}`); return 1; },
    async marcarFalloHls(_i, _l, m) { marcas.push(`fallo:${m}`); return 1; },
    async estadoHls() { return null; },
  };

  // Vigía de /tmp: cada 20 ms cuenta segmentos y bytes que esperan en el disco.
  let maxSeg = 0;
  let maxBytes = 0;
  const medir = setInterval(() => {
    for (const d of fs.existsSync(tmpBase) ? fs.readdirSync(tmpBase) : []) {
      const dir = path.join(tmpBase, d);
      let n = 0;
      let b = 0;
      for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
        if (!/^seg_\d+\.ts(\.tmp)?$/.test(f)) continue;
        try { b += fs.statSync(path.join(dir, f)).size; n++; } catch { /* lo acaban de borrar */ }
      }
      maxSeg = Math.max(maxSeg, n);
      maxBytes = Math.max(maxBytes, b);
    }
  }, 20);

  const t0 = Date.now();
  await rellenarHls(
    {
      repo,
      // Como R2: el archivo en trozos de 64 KB, por pipe.
      leerStream: () => fs.createReadStream(mp4, { highWaterMark: 64 * 1024 }),
      subirArchivo: async (clave, cuerpo) => {
        if (clave.endsWith(".ts")) await new Promise((r) => setTimeout(r, msPorSegmento));
        r2.set(clave, cuerpo);
      },
      borrarPrefijo: async (p) => { for (const k of [...r2.keys()]) if (k.startsWith(p)) r2.delete(k); },
      tmpBase,
      contrapresion: limites,
      hlsIntervaloMs: 100,
      registrar: (m) => console.log(`      [${nombre}] ${m}`),
    },
    "g1",
    new Date("2026-10-22T10:00:00.000Z"),
  );
  clearInterval(medir);
  const segundos = (Date.now() - t0) / 1000;

  // Baja lo "subido" a una carpeta y lo valida con ffprobe.
  const salida = path.join(base, `r2-${nombre}`);
  fs.mkdirSync(salida);
  for (const [k, v] of r2) fs.writeFileSync(path.join(salida, path.basename(k)), v);
  return { marcas, maxSeg, maxBytes, segundos, salida, claves: [...r2.keys()] };
}

async function main() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "prueba-relleno-"));
  console.log(`carpeta: ${base}`);
  const mp4 = path.join(base, "final.mp4");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30,noise=alls=12:allf=t",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", "30", "-c:v", "libx264", "-preset", "veryfast", "-b:v", "8000k", "-g", "60",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+frag_keyframe+empty_moov+default_base_moof", mp4,
  ]);
  console.log(`final.mp4 sintético: ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB, 30 s 1080p`);

  const SEG_LENTO = 1500;
  const con = await correr(base, mp4, "con-tope", { maxSegmentos: 2, maxBytes: 60 * 1024 * 1024 }, SEG_LENTO);
  console.log(`con tope de 2 segmentos: ${con.segundos.toFixed(1)} s, máximo en /tmp ${con.maxSeg} segmentos / ${(con.maxBytes / 1048576).toFixed(1)} MB`);
  const sin = await correr(base, mp4, "sin-tope", { maxSegmentos: Number.MAX_SAFE_INTEGER, maxBytes: Number.MAX_SAFE_INTEGER }, SEG_LENTO);
  console.log(`sin tope (comparación):  ${sin.segundos.toFixed(1)} s, máximo en /tmp ${sin.maxSeg} segmentos / ${(sin.maxBytes / 1048576).toFixed(1)} MB`);

  const hlsKey = "digitalizacion/ws1/g1/hls-" + new Date("2026-10-22T10:00:00.000Z").getTime();
  chequear(con.marcas.length === 1 && con.marcas[0] === `hls:${hlsKey}`, `relleno con tope publicado en ${hlsKey}`);
  chequear(con.claves.every((k) => k.startsWith(`${hlsKey}/`)), "todo lo subido quedó en la carpeta del intento");
  // El que se está escribiendo + los que esperan: nunca más de tope + 1.
  chequear(con.maxSeg <= 3, `/tmp acotado con contrapresión (máx ${con.maxSeg} ≤ 3)`);
  chequear(sin.maxSeg > con.maxSeg, `sin tope se acumulan más (${sin.maxSeg} > ${con.maxSeg})`);

  const pr = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", path.join(con.salida, "index.m3u8")]);
  const j = JSON.parse(pr.stdout) as { format: { duration: string }; streams: { codec_name: string; width?: number; height?: number }[] };
  const dur = Number(j.format.duration);
  const v = j.streams.find((s) => s.width);
  console.log(`ffprobe del HLS: ${dur.toFixed(2)} s, ${j.streams.map((s) => s.codec_name).join("+")}, ${v?.width}×${v?.height}`);
  chequear(Math.abs(dur - 30) < 0.6, "duración ≈ 30 s");
  chequear(v?.width === 1280 && v?.height === 720, "720p");
  chequear(j.streams.some((s) => s.codec_name === "aac") && j.streams.some((s) => s.codec_name === "h264"), "H.264 + AAC");

  fs.rmSync(base, { recursive: true, force: true });
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

void main();
