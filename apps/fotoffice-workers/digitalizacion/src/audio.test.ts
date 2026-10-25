import { describe, expect, it, vi } from "vitest";
import { BYTES_SONDEO, detectarAudio, type DepsAudio, type ResultadoSondeo } from "./audio";

function deps(r: ResultadoSondeo | Error, leer?: () => Promise<Buffer>) {
  const log: string[] = [];
  const leerInicio = vi.fn(leer ?? (async () => Buffer.from("cabecera")));
  const d: DepsAudio = {
    leerInicio,
    sondear: async () => {
      if (r instanceof Error) throw r;
      return r;
    },
    registrar: (m) => log.push(m),
  };
  return { d, log, leerInicio };
}

describe("detectarAudio", () => {
  it("con una pista de audio da true y sólo pide el comienzo", async () => {
    const { d, log, leerInicio } = deps({ codigo: 0, salida: '{"streams":[{"codec_type":"audio"}]}', error: "" });
    expect(await detectarAudio("t1/0", d)).toBe(true);
    expect(leerInicio).toHaveBeenCalledWith("t1/0", BYTES_SONDEO);
    expect(BYTES_SONDEO).toBe(8 * 1024 * 1024);
    expect(log).toEqual([]);
  });
  it("sin pistas de audio da false", async () => {
    const { d, log } = deps({ codigo: 0, salida: '{"streams":[]}', error: "" });
    expect(await detectarAudio("t1/0", d)).toBe(false);
    expect(log).toEqual([]);
  });
  it("ffprobe que falla: se asume audio y queda en el log", async () => {
    const { d, log } = deps({ codigo: 1, salida: '{"streams":[]}', error: "pipe:0: Invalid data found" });
    expect(await detectarAudio("t1/0", d)).toBe(true);
    expect(log[0]).toContain("se asume que sí");
    expect(log[0]).toContain("Invalid data found");
  });
  it("salida ilegible: se asume audio", async () => {
    const { d, log } = deps({ codigo: 0, salida: "basura", error: "" });
    expect(await detectarAudio("t1/0", d)).toBe(true);
    expect(log).toHaveLength(1);
  });
  it("ffprobe que no arranca: se asume audio", async () => {
    const { d, log } = deps(new Error("spawn ffprobe ENOENT"));
    expect(await detectarAudio("t1/0", d)).toBe(true);
    expect(log[0]).toContain("ENOENT");
  });
  it("error de red al leer R2: se asume audio", async () => {
    const { d, log } = deps({ codigo: 0, salida: '{"streams":[]}', error: "" }, async () => {
      throw new Error("ECONNRESET");
    });
    expect(await detectarAudio("t1/0", d)).toBe(true);
    expect(log[0]).toContain("ECONNRESET");
  });
  it("parte vacía: se asume audio", async () => {
    const { d } = deps({ codigo: 0, salida: '{"streams":[]}', error: "" }, async () => Buffer.alloc(0));
    expect(await detectarAudio("t1/0", d)).toBe(true);
  });
});
