import { describe, expect, it } from "vitest";
import { FORMATOS_PREFERIDOS, elegirFormato } from "./formato";

describe("elegirFormato", () => {
  it("prefiere MP4 si el navegador lo soporta", () => expect(elegirFormato(() => true)).toBe(FORMATOS_PREFERIDOS[0]));
  it("cae a WebM H.264 y después a VP9", () => {
    expect(elegirFormato((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=h264,opus");
    expect(elegirFormato((m) => m.includes("vp9"))).toBe("video/webm;codecs=vp9,opus");
  });
  it("null si no soporta ninguno", () => expect(elegirFormato(() => false)).toBeNull());
});
