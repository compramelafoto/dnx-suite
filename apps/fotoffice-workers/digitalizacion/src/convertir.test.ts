import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { convertirGrabacion, mensajeError, type DepsConvertir } from "./convertir";
import type { Repo } from "./repo";

const LOCK = new Date("2026-11-30T10:00:00.000Z");
let carpeta: string;
beforeAll(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "digi-test-"));
});
afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

/** ffmpeg falso: lee cada entrada pipe:N en orden como el real, escribe a stdout y sale con `salida`. */
function ffmpegFalso(nombre: string, cola: string): string {
  const p = path.join(carpeta, nombre);
  fs.writeFileSync(
    p,
    `#!/bin/sh
prev=""
for a in "$@"; do
  if [ "$prev" = "-i" ]; then case "$a" in pipe:*) n="\${a#pipe:}"; eval "cat <&$n > /dev/null";; esac; fi
  prev="$a"
done
echo "frame=1 time=00:00:05.00 speed=1x" >&2
${cola}
`,
    { mode: 0o755 },
  );
  return p;
}

function armar(over: Partial<DepsConvertir> = {}, intentos = 1) {
  const llamadas: string[] = [];
  const borrados: string[] = [];
  const renovaciones: [Date, Date][] = [];
  const archivos: { clave: string; tipo: string }[] = [];
  const listas: { hlsKey?: string | null }[] = [];
  const filas = { sinImagen: 1, error: 1, lista: 1, renovar: 1 };
  let estadoFila: string | null = "PROCESANDO";
  const repo: Repo = {
    async cargar() {
      return {
        id: "g1",
        workspaceId: "ws",
        intentos,
        grabacion: { tipo: "VHS", corregirProporcion: false, sinImagen: false, primeraImagenSeg: null, ultimaImagenSeg: null, ultimaImagenTramo: null },
        partes: [
          { tramo: 1, indice: 0, key: "digitalizacion/ws/g1/t1/0" },
          { tramo: 2, indice: 0, key: "digitalizacion/ws/g1/t2/0" },
        ],
        branding: { commercialName: "Estudio", logoUrl: null, whatsapp: null },
      };
    },
    async marcarSinImagen() { llamadas.push("sinImagen"); return filas.sinImagen; },
    async marcarPartesBorradasSinImagen() { llamadas.push("partesBorradasSinImagen"); return 1; },
    async marcarError(_i, _l, m) { llamadas.push(`error:${m}`); return filas.error; },
    async marcarLista(_i, _l, d) { llamadas.push("lista"); listas.push(d); return filas.lista; },
    async marcarPartesBorradas() { llamadas.push("partesBorradas"); return 1; },
    async renovarLock(_i, v, n) { renovaciones.push([v, n]); return filas.renovar; },
    async estado() { return estadoFila; },
  };
  const deps: DepsConvertir = {
    repo,
    preset: "veryfast",
    esperasMs: [1, 1, 1, 1],
    tmpBase: carpeta,
    registrar: () => {},
    leerParte: async () => Buffer.from("datos"),
    subirStream: async (_k: string, s: Readable) => {
      let n = 0;
      for await (const c of s) n += (c as Buffer).length;
      return n;
    },
    borrarPrefijo: async (p) => { borrados.push(p); },
    subirArchivo: async (clave, _c, tipo) => { archivos.push({ clave, tipo }); },
    hlsIntervaloMs: 20,
    hlsEsperasMs: [1, 1],
    ffmpegPath: ffmpegFalso("ok.sh", `echo contenido\nexit 0`),
    ...over,
  };
  return { deps, llamadas, borrados, filas, renovaciones, archivos, listas, poner: (e: string | null) => (estadoFila = e) };
}

describe("convertirGrabacion", () => {
  it("camino feliz: LISTA, después borra los pedacitos", async () => {
    const { deps, llamadas, borrados } = armar();
    await convertirGrabacion(deps, "g1", LOCK);
    expect(llamadas).toEqual(["lista", "partesBorradas"]);
    expect(borrados).toEqual(["digitalizacion/ws/g1/t"]);
  });

  it("si falla la limpieza después de LISTA conserva el video y no marca ERROR", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, llamadas, borrados } = armar({
      borrarPrefijo: async (p) => {
        borrados2.push(p);
        throw new Error("R2 caído");
      },
    });
    const borrados2: string[] = [];
    await convertirGrabacion(deps, "g1", LOCK);
    err.mockRestore();
    expect(llamadas).toEqual(["lista"]);
    expect(borrados2).toEqual(["digitalizacion/ws/g1/t"]); // nunca la clave del video final
    expect(borrados).toEqual([]);
  });

  it("si falla marcarPartesBorradas tampoco toca el video", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar();
    ctx.deps.repo.marcarPartesBorradas = async () => { throw new Error("base caída"); };
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.llamadas).toEqual(["lista"]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/t"]);
  });

  it("ffmpeg con código distinto de 0: ERROR, borra el final parcial y deja las partes", async () => {
    const { deps, llamadas, borrados } = armar({
      ffmpegPath: ffmpegFalso("falla.sh", `echo parcial\necho "Error opening input" >&2\nexit 1`),
    });
    await convertirGrabacion(deps, "g1", LOCK);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toBe("error:ffmpeg terminó con código 1."); // el detalle va sólo a los logs
    expect(borrados).toEqual(["digitalizacion/ws/g1/final.mp4"]);
  });

  it("subida rechazada: aborta ffmpeg, ERROR y deja las partes", async () => {
    const { deps, llamadas, borrados } = armar({
      ffmpegPath: ffmpegFalso("cuelga.sh", `exec sleep 30`),
      subirStream: async () => { throw new Error("multiparte rechazada"); },
    });
    const t0 = Date.now();
    await convertirGrabacion(deps, "g1", LOCK);
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toContain("error:multiparte rechazada");
    expect(borrados).toEqual(["digitalizacion/ws/g1/final.mp4"]);
  });

  it("ffmpeg sale con 0 sin leer sus entradas y los sockets dan ECONNRESET: queda LISTA, sin caídas", async () => {
    const noCapturados: unknown[] = [];
    const h = (e: unknown) => noCapturados.push(e);
    process.on("uncaughtException", h);
    process.on("unhandledRejection", h);
    const { deps, llamadas } = armar({
      ffmpegPath: ffmpegFalso("sinleer.sh", `echo contenido\nexit 0`),
      // Parte lenta: el error del socket llega mientras el escritor espera a R2.
      leerParte: async () => {
        await new Promise((r) => setTimeout(r, 300));
        return Buffer.from("datos");
      },
    });
    await convertirGrabacion(
      {
        ...deps,
        // Simula el ECONNRESET que Node recibe en Linux al cerrar el lector con datos sin leer.
        alLanzar: (ff) => {
          setTimeout(() => {
            for (const i of [3, 4]) {
              (ff.stdio[i] as Readable).destroy(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));
            }
          }, 100);
        },
      },
      "g1",
      LOCK,
    );
    await new Promise((r) => setTimeout(r, 500));
    process.off("uncaughtException", h);
    process.off("unhandledRejection", h);
    expect(noCapturados).toEqual([]);
    expect(llamadas).toEqual(["lista", "partesBorradas"]);
  });

  it("sin progreso mata ffmpeg por inactividad", async () => {
    const { deps, llamadas } = armar({
      ffmpegPath: ffmpegFalso("mudo.sh", `exec sleep 30`),
      inactividadMs: 800,
    });
    await convertirGrabacion(deps, "g1", LOCK);
    expect(llamadas[0]).toContain("sin progreso");
  });

  it("si marcarError lanza, no propaga", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({ ffmpegPath: ffmpegFalso("falla2.sh", `exit 2`) });
    ctx.deps.repo.marcarError = async () => { throw new Error("base caída"); };
    await expect(convertirGrabacion(ctx.deps, "g1", LOCK)).resolves.toBeUndefined();
    err.mockRestore();
  });
});

/** ffmpeg falso que además escribe la versión HLS donde dicen los argumentos (si se la piden). */
function ffmpegConHls(nombre: string, playlist: string, salida = 0): string {
  const p = path.join(carpeta, nombre);
  fs.writeFileSync(
    p,
    `#!/bin/sh
prev=""; seg=""; last=""
for a in "$@"; do
  if [ "$prev" = "-i" ]; then case "$a" in pipe:*) n="\${a#pipe:}"; eval "cat <&$n > /dev/null";; esac; fi
  if [ "$prev" = "-hls_segment_filename" ]; then seg="$a"; fi
  prev="$a"; last="$a"
done
if [ -n "$seg" ]; then
  d=$(dirname "$last")
  echo s1 > "$d/seg_00001.ts"; sleep 0.1; echo s2 > "$d/seg_00002.ts"; sleep 0.1
  printf '${playlist}' > "$last"
fi
echo "frame=1 time=00:00:12.00 speed=1x" >&2
echo contenido
exit ${salida}
`,
    { mode: 0o755 },
  );
  return p;
}
const PLAYLIST_OK = "#EXTM3U\\n#EXTINF:6,\\nseg_00001.ts\\n#EXTINF:6,\\nseg_00002.ts\\n#EXT-X-ENDLIST\\n";

describe("versión para mirar (HLS) durante la conversión", () => {
  it("sube los segmentos y la playlist y guarda hlsKey en la misma escritura de LISTA", async () => {
    const ctx = armar({ ffmpegPath: ffmpegConHls("hls-ok.sh", PLAYLIST_OK) });
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["lista", "partesBorradas"]);
    expect(ctx.listas[0]!.hlsKey).toBe("digitalizacion/ws/g1/hls");
    expect(ctx.archivos.map((a) => a.clave)).toEqual([
      "digitalizacion/ws/g1/hls/seg_00001.ts",
      "digitalizacion/ws/g1/hls/seg_00002.ts",
      "digitalizacion/ws/g1/hls/index.m3u8",
    ]);
    expect(ctx.archivos.at(-1)!.tipo).toBe("application/vnd.apple.mpegurl");
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/t"]);
  });

  it("si el HLS falla, el MP4 no se pierde: LISTA sin hlsKey y se limpia lo subido del HLS", async () => {
    const ctx = armar({ ffmpegPath: ffmpegConHls("hls-sin-fin.sh", "#EXTM3U\\n#EXTINF:6,\\nseg_00001.ts\\n") });
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["lista", "partesBorradas"]);
    expect(ctx.listas[0]!.hlsKey).toBeNull();
    expect(ctx.archivos.map((a) => a.clave)).not.toContain("digitalizacion/ws/g1/hls/index.m3u8");
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/hls/", "digitalizacion/ws/g1/t"]);
  });

  it("si la subida de un segmento falla, igual queda LISTA sin hlsKey", async () => {
    const ctx = armar({ ffmpegPath: ffmpegConHls("hls-r2.sh", PLAYLIST_OK), subirArchivo: async () => { throw new Error("R2 caído"); } });
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["lista", "partesBorradas"]);
    expect(ctx.listas[0]!.hlsKey).toBeNull();
  });

  it("ffmpeg falla: ERROR y se borran el final y el HLS a medias", async () => {
    const ctx = armar({ ffmpegPath: ffmpegConHls("hls-falla.sh", PLAYLIST_OK, 1) });
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["error:ffmpeg terminó con código 1."]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/final.mp4", "digitalizacion/ws/g1/hls/"]);
  });

  it("desde el segundo intento sólo hace el MP4 (el HLS lo arma el relleno)", async () => {
    let args: string[] = [];
    const ctx = armar({ ffmpegPath: ffmpegConHls("hls-2do.sh", PLAYLIST_OK), alLanzar: (ff) => (args = ff.spawnargs) }, 2);
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(args.join(" ")).not.toContain("-f hls");
    expect(ctx.archivos).toEqual([]);
    expect(ctx.listas[0]!.hlsKey).toBeNull();
  });
});

describe("mensajeError", () => {
  it("guarda sólo la causa, acotada a 200 caracteres", () => {
    expect(mensajeError("Causa clara. " + "x".repeat(500)).length).toBe(200);
    expect(mensajeError("  falló\n  feo ")).toBe("falló feo");
  });
});

describe("propiedad y reintentos", () => {
  it("si marcarLista toca 0 filas: no borra partes crudas y deja el final si otro la dejó LISTA", async () => {
    const ctx = armar();
    ctx.filas.lista = 0;
    ctx.poner("LISTA");
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["lista"]);
    expect(ctx.borrados).toEqual([]);
  });
  it("si marcarLista toca 0 filas y la fila no está LISTA, borra sólo nuestro final.mp4 (no las partes)", async () => {
    const ctx = armar();
    ctx.filas.lista = 0;
    ctx.poner("PENDIENTE");
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["lista"]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/final.mp4"]);
  });
  it("si falla ffmpeg pero la fila ya está LISTA (de otro), no borra el final", async () => {
    const ctx = armar({ ffmpegPath: ffmpegFalso("falla3.sh", `exit 1`) });
    ctx.poner("LISTA");
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.borrados).toEqual([]);
  });
  it("renueva el token desde el vigía y lo usa para cerrar", async () => {
    const ctx = armar({ ffmpegPath: ffmpegFalso("lento.sh", `sleep 1\necho contenido\nexit 0`), renovarMs: 150 });
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.renovaciones.length).toBeGreaterThan(0);
    expect(ctx.renovaciones[0][0]).toEqual(LOCK);
    expect(ctx.renovaciones[0][1].getTime()).toBeGreaterThan(LOCK.getTime());
    expect(ctx.llamadas).toEqual(["lista", "partesBorradas"]);
  });
  it("si la renovación toca 0 filas: mata ffmpeg y no marca nada", async () => {
    const ctx = armar({ ffmpegPath: ffmpegFalso("cuelga2.sh", `exec sleep 30`), renovarMs: 100 });
    ctx.filas.renovar = 0;
    ctx.poner("PROCESANDO");
    const t0 = Date.now();
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(ctx.llamadas).toEqual([]);
  });
  it("reintenta marcarLista ante un error transitorio de la base", async () => {
    const ctx = armar();
    let n = 0;
    const original = ctx.deps.repo.marcarLista;
    ctx.deps.repo.marcarLista = async (...a) => {
      if (++n < 3) throw new Error("conexión cortada");
      return original(...a);
    };
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(n).toBe(3);
    expect(ctx.llamadas).toEqual(["lista", "partesBorradas"]);
  });
  it("si la base no vuelve tras los reintentos, deja el video y no marca ERROR", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar();
    ctx.deps.repo.marcarLista = async () => { throw new Error("base caída"); };
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    err.mockRestore();
    expect(ctx.llamadas).toEqual([]);
    expect(ctx.borrados).toEqual([]);
  });
  it("SIN_IMAGEN borra las partes crudas y marca partesBorradasAt", async () => {
    const ctx = armar();
    const cargar = ctx.deps.repo.cargar;
    ctx.deps.repo.cargar = async (id) => {
      const d = (await cargar(id))!;
      return { ...d, grabacion: { ...d.grabacion, sinImagen: true } };
    };
    await convertirGrabacion(ctx.deps, "g1", LOCK);
    expect(ctx.llamadas).toEqual(["sinImagen", "partesBorradasSinImagen"]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/t"]);
  });
});
