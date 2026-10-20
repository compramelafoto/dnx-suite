import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { convertirGrabacion, mensajeError, type DepsConvertir } from "./convertir";
import type { Repo } from "./repo";

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
    async marcarSinImagen() { llamadas.push("sinImagen"); },
    async marcarError(_i, m) { llamadas.push(`error:${m}`); },
    async marcarLista() { llamadas.push("lista"); },
    async marcarPartesBorradas() { llamadas.push("partesBorradas"); },
  };
  const deps: DepsConvertir = {
    repo,
    preset: "veryfast",
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
  return { deps, llamadas, borrados };
}

describe("convertirGrabacion", () => {
  it("camino feliz: LISTA, después borra los pedacitos", async () => {
    const { deps, llamadas, borrados } = armar();
    await convertirGrabacion(deps, "g1");
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
    await convertirGrabacion(deps, "g1");
    err.mockRestore();
    expect(llamadas).toEqual(["lista"]);
    expect(borrados2).toEqual(["digitalizacion/ws/g1/t"]); // nunca la clave del video final
    expect(borrados).toEqual([]);
  });

  it("si falla marcarPartesBorradas tampoco toca el video", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar();
    ctx.deps.repo.marcarPartesBorradas = async () => { throw new Error("base caída"); };
    await convertirGrabacion(ctx.deps, "g1");
    err.mockRestore();
    expect(ctx.llamadas).toEqual(["lista"]);
    expect(ctx.borrados).toEqual(["digitalizacion/ws/g1/t"]);
  });

  it("ffmpeg con código distinto de 0: ERROR, borra el final parcial y deja las partes", async () => {
    const { deps, llamadas, borrados } = armar({
      ffmpegPath: ffmpegFalso("falla.sh", `echo parcial\necho "Error opening input" >&2\nexit 1`),
    });
    await convertirGrabacion(deps, "g1");
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatch(/^error:ffmpeg terminó con código 1\. — .*Error opening input/);
    expect(borrados).toEqual(["digitalizacion/ws/g1/final.mp4"]);
  });

  it("subida rechazada: aborta ffmpeg, ERROR y deja las partes", async () => {
    const { deps, llamadas, borrados } = armar({
      ffmpegPath: ffmpegFalso("cuelga.sh", `exec sleep 30`),
      subirStream: async () => { throw new Error("multiparte rechazada"); },
    });
    const t0 = Date.now();
    await convertirGrabacion(deps, "g1");
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toContain("error:multiparte rechazada");
    expect(borrados).toEqual(["digitalizacion/ws/g1/final.mp4"]);
  });

  it("sin progreso mata ffmpeg por inactividad", async () => {
    const { deps, llamadas } = armar({
      ffmpegPath: ffmpegFalso("mudo.sh", `exec sleep 30`),
      inactividadMs: 800,
    });
    await convertirGrabacion(deps, "g1");
    expect(llamadas[0]).toContain("sin progreso");
  });

  it("si marcarError lanza, no propaga", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = armar({ ffmpegPath: ffmpegFalso("falla2.sh", `exit 2`) });
    ctx.deps.repo.marcarError = async () => { throw new Error("base caída"); };
    await expect(convertirGrabacion(ctx.deps, "g1")).resolves.toBeUndefined();
    err.mockRestore();
  });
});

describe("mensajeError", () => {
  it("conserva siempre la causa y sólo la cola del detalle", () => {
    const m = mensajeError("Causa clara. " + "x".repeat(500), "A".repeat(2000) + "FINAL", 1);
    expect(m.startsWith("Causa clara.")).toBe(true);
    expect(m.endsWith("FINAL")).toBe(true);
    expect(m.length).toBeLessThanOrEqual(200 + 3 + 600);
  });
  it("agrega (último intento) al tercero", () => {
    expect(mensajeError("falló", "", 3)).toBe("falló (último intento)");
  });
});
