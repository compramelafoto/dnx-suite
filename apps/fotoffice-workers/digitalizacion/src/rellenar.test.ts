import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rellenarHls, type DepsRelleno } from "./rellenar";
import type { RepoRelleno } from "./repo";

const LOCK = new Date("2026-11-30T10:00:00.000Z");
let carpeta: string;
beforeAll(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "relleno-test-"));
});
afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

/** ffmpeg falso: lee pipe:3 entero y escribe segmentos y playlist donde dicen los argumentos. */
function ffmpegFalso(nombre: string, playlist: string, salida = 0): string {
  const p = path.join(carpeta, nombre);
  fs.writeFileSync(
    p,
    `#!/bin/sh
last=""
for a in "$@"; do last="$a"; done
cat <&3 > /dev/null
d=$(dirname "$last")
echo s1 > "$d/seg_00001.ts"; sleep 0.1; echo s2 > "$d/seg_00002.ts"; sleep 0.1
printf '${playlist}' > "$last"
echo "frame=1 time=00:00:12.00 speed=1x" >&2
exit ${salida}
`,
    { mode: 0o755 },
  );
  return p;
}
const PLAYLIST_OK = "#EXTM3U\\n#EXTINF:6,\\nseg_00001.ts\\n#EXTINF:6,\\nseg_00002.ts\\n#EXT-X-ENDLIST\\n";

function armar(over: Partial<DepsRelleno> = {}, videoKey: string | null = "digitalizacion/ws/g1/final.mp4") {
  const llamadas: string[] = [];
  const borrados: string[] = [];
  const archivos: string[] = [];
  const filas = { hls: 1 };
  let hlsActual: string | null = null;
  const repo: RepoRelleno = {
    async cargarRelleno() { return { id: "g1", workspaceId: "ws", videoKey }; },
    async renovarLockRelleno() { return 1; },
    async marcarHls(_i, _l, k) { llamadas.push(`hls:${k}`); return filas.hls; },
    async marcarFalloHls(_i, _l, m) { llamadas.push(`fallo:${m}`); return 1; },
    async estadoHls() { return hlsActual; },
  };
  const deps: DepsRelleno = {
    repo,
    leerStream: () => Readable.from([Buffer.from("mp4 ")]),
    subirArchivo: async (clave) => { archivos.push(clave); },
    borrarPrefijo: async (p) => { borrados.push(p); },
    ffmpegPath: ffmpegFalso("ok.sh", PLAYLIST_OK),
    tmpBase: carpeta,
    registrar: () => {},
    hlsIntervaloMs: 20,
    hlsEsperasMs: [1],
    ...over,
  };
  return { deps, llamadas, borrados, archivos, filas, ponerHls: (k: string | null) => (hlsActual = k) };
}

describe("rellenarHls", () => {
  it("camino feliz: limpia restos, sube segmentos y playlist y guarda hlsKey con el token", async () => {
    const ctx = armar();
    await rellenarHls(ctx.deps, "g1", LOCK);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls/"]);
    expect(ctx.archivos).toEqual([
      "digitalizacion/ws/g1/hls/seg_00001.ts",
      "digitalizacion/ws/g1/hls/seg_00002.ts",
      "digitalizacion/ws/g1/hls/index.m3u8",
    ]);
    expect(ctx.llamadas).toEqual(["hls:digitalizacion/ws/g1/hls"]);
  });

  it("ffmpeg falla: anota el intento, borra lo subido y nunca el MP4", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({ ffmpegPath: ffmpegFalso("falla.sh", PLAYLIST_OK, 1) });
    await rellenarHls(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.llamadas).toEqual(["fallo:ffmpeg terminó con código 1."]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls/", "digitalizacion/ws/g1/hls/"]);
    expect(ctx.borrados.some((b) => b.includes("final.mp4"))).toBe(false);
  });

  it("si falla la lectura de R2, falla el relleno", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({
      ffmpegPath: ffmpegFalso("espera.sh", PLAYLIST_OK),
      leerStream: () =>
        new Readable({
          read() {
            this.destroy(new Error("conexión cortada"));
          },
        }),
    });
    await rellenarHls(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.llamadas).toHaveLength(1);
    expect(ctx.llamadas[0]).toContain("fallo:No se pudo leer el video de R2");
  });

  it("clave del video con forma inesperada: no corre ffmpeg y anota el intento", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({}, "otra/cosa.mp4");
    await rellenarHls(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.archivos).toEqual([]);
    expect(ctx.borrados).toEqual([]);
    expect(ctx.llamadas[0]).toMatch(/^fallo:/);
  });

  it("si marcarHls toca 0 filas (video vencido mientras tanto), borra lo subido", async () => {
    const ctx = armar();
    ctx.filas.hls = 0;
    await rellenarHls(ctx.deps, "g1", LOCK);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls/", "digitalizacion/ws/g1/hls/"]);
  });
});
