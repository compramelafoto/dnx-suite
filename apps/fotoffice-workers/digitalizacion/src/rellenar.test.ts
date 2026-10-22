import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bombear, rellenarHls, type DepsRelleno } from "./rellenar";
import type { RepoRelleno } from "./repo";

const LOCK = new Date("2026-11-30T10:00:00.000Z");
const H = `digitalizacion/ws/g1/hls-${LOCK.getTime()}`;
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
  it("camino feliz: borra todas las carpetas hls* viejas, sube a la del intento y guarda hlsKey con el token", async () => {
    const ctx = armar();
    await rellenarHls(ctx.deps, "g1", LOCK);
    // Sin barra: `hls`, `hls-<ms>` de intentos anteriores, todo.
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls"]);
    expect(ctx.archivos).toEqual([`${H}/seg_00001.ts`, `${H}/seg_00002.ts`, `${H}/index.m3u8`]);
    expect(ctx.llamadas).toEqual([`hls:${H}`]);
  });

  it("el vigía de inactividad se apaga antes de subir lo último (una playlist lenta no mata el relleno)", async () => {
    const conProgreso = path.join(carpeta, "progreso.sh");
    fs.writeFileSync(
      conProgreso,
      `#!/bin/sh
last=""
for a in "$@"; do last="$a"; done
echo "frame=1 time=00:00:01.00 speed=1x" >&2
cat <&3 > /dev/null
d=$(dirname "$last")
echo s1 > "$d/seg_00001.ts"; echo "time=00:00:06.00" >&2; echo s2 > "$d/seg_00002.ts"; echo "time=00:00:12.00" >&2
printf '${PLAYLIST_OK}' > "$last"
exit 0
`,
      { mode: 0o755 },
    );
    const ctx = armar({
      ffmpegPath: conProgreso,
      inactividadMs: 800,
      subirArchivo: async (clave) => {
        ctx.archivos.push(clave);
        if (clave.endsWith("index.m3u8")) await new Promise((r) => setTimeout(r, 2000));
      },
    });
    await rellenarHls(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual([`hls:${H}`]);
  });

  it("ffmpeg falla: anota el intento, borra lo subido y nunca el MP4", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({ ffmpegPath: ffmpegFalso("falla.sh", PLAYLIST_OK, 1) });
    await rellenarHls(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.llamadas).toEqual(["fallo:ffmpeg terminó con código 1."]);
    // Sólo su propia carpeta.
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls", `${H}/`]);
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
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls", `${H}/`]);
  });
});

describe("bombear (contrapresión)", () => {
  function destinoFalso() {
    const escrito: string[] = [];
    const d = new Writable({
      write(chunk, _enc, cb) {
        escrito.push(chunk.toString());
        cb();
      },
    });
    return { d, escrito };
  }
  const limites = { maxSegmentos: 3, maxBytes: 1000 };

  it("frena la lectura mientras hay demasiados segmentos esperando y sigue cuando bajan", async () => {
    const { d, escrito } = destinoFalso();
    let pendientes = { cantidad: 0, bytes: 0, subibles: 0 };
    let leidos = 0;
    async function* fuente() {
      for (let i = 1; i <= 4; i++) {
        leidos = i;
        yield Buffer.from(`c${i}`);
      }
    }
    const frenos: number[] = [];
    const p = bombear(fuente(), d, {
      pendientes: async () => pendientes,
      limites,
      cortado: () => false,
      mirarCadaMs: 0,
      esperaMs: 5,
      alFrenar: (x) => frenos.push(x.cantidad),
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(escrito).toEqual(["c1", "c2", "c3", "c4"]);
    // Ahora, otra pasada con la carpeta llena.
    const otro = destinoFalso();
    pendientes = { cantidad: 3, bytes: 10, subibles: 2 };
    leidos = 0;
    const q = bombear(fuente(), otro.d, { pendientes: async () => pendientes, limites, cortado: () => false, mirarCadaMs: 0, esperaMs: 5, alFrenar: (x) => frenos.push(x.cantidad) });
    await new Promise((r) => setTimeout(r, 40));
    expect(otro.escrito).toEqual([]);
    // El generador no avanza mientras está frenado: no se lee de R2 de más.
    expect(leidos).toBe(1);
    pendientes = { cantidad: 2, bytes: 10, subibles: 1 };
    await q;
    await p;
    expect(otro.escrito).toEqual(["c1", "c2", "c3", "c4"]);
    expect(frenos).toEqual([3]);
    expect(otro.d.writableEnded).toBe(true);
  });

  it("también frena por bytes", async () => {
    const { d, escrito } = destinoFalso();
    let pendientes = { cantidad: 1, bytes: 1000, subibles: 1 };
    const q = bombear((async function* () { yield Buffer.from("x"); })(), d, { pendientes: async () => pendientes, limites, cortado: () => false, mirarCadaMs: 0, esperaMs: 5 });
    await new Promise((r) => setTimeout(r, 30));
    expect(escrito).toEqual([]);
    pendientes = { cantidad: 1, bytes: 999, subibles: 1 };
    await q;
    expect(escrito).toEqual(["x"]);
  });

  it("nunca frena si no hay nada para subir (el segmento a medio escribir solo no puede bajar sin entrada)", async () => {
    const { d, escrito } = destinoFalso();
    await bombear((async function* () { yield Buffer.from("x"); yield Buffer.from("y"); })(), d, {
      pendientes: async () => ({ cantidad: 1, bytes: 5000, subibles: 0 }),
      limites,
      cortado: () => false,
      mirarCadaMs: 0,
      esperaMs: 5,
    });
    expect(escrito).toEqual(["x", "y"]);
  });

  it("si se corta mientras está frenado, sale sin escribir", async () => {
    const { d, escrito } = destinoFalso();
    let cortado = false;
    const q = bombear((async function* () { yield Buffer.from("x"); })(), d, { pendientes: async () => ({ cantidad: 9, bytes: 0, subibles: 8 }), limites, cortado: () => cortado, mirarCadaMs: 0, esperaMs: 5 });
    setTimeout(() => (cortado = true), 20);
    await q;
    expect(escrito).toEqual([]);
  });
});
