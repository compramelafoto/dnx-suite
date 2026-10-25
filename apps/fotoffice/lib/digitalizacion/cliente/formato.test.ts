import { describe, expect, it } from "vitest";
import { FORMATOS_PREFERIDOS, elegirFormato, elegirFormatoQueFunciona } from "./formato";

describe("elegirFormato", () => {
  it("prefiere MP4 si el navegador lo soporta", () => expect(elegirFormato(() => true)).toBe(FORMATOS_PREFERIDOS[0]));
  it("cae a WebM H.264 y después a VP9", () => {
    expect(elegirFormato((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=h264,opus");
    expect(elegirFormato((m) => m.includes("vp9"))).toBe("video/webm;codecs=vp9,opus");
  });
  it("null si no soporta ninguno", () => expect(elegirFormato(() => false)).toBeNull());
});

describe("elegirFormatoQueFunciona", () => {
  it("usa el primero que dice soportar Y que graba de verdad", async () => {
    const probados: string[] = [];
    const r = await elegirFormatoQueFunciona(
      () => true,
      async (m) => {
        probados.push(m);
        return m.startsWith("video/mp4") ? { ok: false, error: "EncodingError: falló el codificador" } : { ok: true };
      },
    );
    expect(r).toEqual({ ok: true, mime: "video/webm;codecs=h264,opus", fallas: ["video/mp4 (EncodingError: falló el codificador)"] });
    expect(probados).toEqual(["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=h264,opus"]);
  });
  it("no prueba los que el navegador dice no soportar", async () => {
    const probados: string[] = [];
    const r = await elegirFormatoQueFunciona((m) => m.includes("vp9"), async (m) => { probados.push(m); return { ok: true }; });
    expect(r).toEqual({ ok: true, mime: "video/webm;codecs=vp9,opus", fallas: [] });
    expect(probados).toEqual(["video/webm;codecs=vp9,opus"]);
  });
  it("si ninguno graba, devuelve las fallas para mostrarlas", async () => {
    const r = await elegirFormatoQueFunciona(() => true, async () => ({ ok: false, error: "sin datos" }));
    expect(r).toEqual({
      ok: false,
      fallas: ["video/mp4 (sin datos)", "video/webm h264 (sin datos)", "video/webm vp9 (sin datos)"],
    });
  });
});
