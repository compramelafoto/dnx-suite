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
    async marcarLista() { llamadas.push("lista"); return filas.lista; },
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
    ffmpegPath: ffmpegFalso("ok.sh", `echo contenido\nexit 0`),
    ...over,
  };
  return { deps, llamadas, borrados, filas, renovaciones, poner: (e: string | null) => (estadoFila = e) };
}

describe("convertirGrabacion", () => {
  it("detecta el audio de la 1.ª parte de cada tramo y arma el filtro con silencio donde falta", async () => {
    let args: string[] = [];
    const pedidas: string[] = [];
    const log: string[] = [];
    const { deps, llamadas } = armar({
      detectarAudio: async (clave) => {
        pedidas.push(clave);
        return !clave.includes("/t2/");
      },
      alLanzar: (ff) => (args = ff.spawnargs),
      registrar: (m) => log.push(m),
    });
    await convertirGrabacion(deps, "g1", LOCK);
    expect(llamadas).toEqual(["lista", "partesBorradas"]);
    expect(pedidas.sort()).toEqual(["digitalizacion/ws/g1/t1/0", "digitalizacion/ws/g1/t2/0"]);
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("[0:a:0]aresample=48000[a0]");
    expect(filtro).toContain("anullsrc=r=48000:cl=stereo,atrim=end_sample=0[a1]");
    expect(filtro).toContain("concat=n=3:v=1:a=1");
    expect(log.some((m) => m.includes("tramo 2 no tiene pista de audio"))).toBe(true);
  });

  it("sin detector (o si dice que todo tiene audio) el filtro es el de siempre", async () => {
    let args: string[] = [];
    const { deps } = armar({ detectarAudio: async () => true, alLanzar: (ff) => (args = ff.spawnargs) });
    await convertirGrabacion(deps, "g1", LOCK);
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("[1:a:0]aresample=48000[a1]");
    expect(filtro).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]");
    expect(filtro).not.toContain("anullsrc");
  });

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
