import { describe, expect, it } from "vitest";
import { accionAnteError, mensajeDeEstado, modoDeReproduccion } from "./reproductor";

describe("modoDeReproduccion", () => {
  it("Safari reproduce solo; el resto usa hls.js; si no hay ninguno, no se puede", () => {
    expect(modoDeReproduccion("maybe", true)).toBe("NATIVO");
    expect(modoDeReproduccion("probably", false)).toBe("NATIVO");
    expect(modoDeReproduccion("", true)).toBe("HLSJS");
    expect(modoDeReproduccion("", false)).toBe("NINGUNO");
  });
});

describe("accionAnteError", () => {
  it("red: recarga la playlist (firmas nuevas) dos veces y después se rinde", () => {
    expect(accionAnteError("networkError", 0, 0)).toBe("RECARGAR");
    expect(accionAnteError("networkError", 1, 0)).toBe("RECARGAR");
    expect(accionAnteError("networkError", 2, 0)).toBe("RENDIRSE");
  });
  it("media: una recuperación; otro tipo: se rinde", () => {
    expect(accionAnteError("mediaError", 0, 0)).toBe("RECUPERAR_MEDIA");
    expect(accionAnteError("mediaError", 0, 1)).toBe("RENDIRSE");
    expect(accionAnteError("muxError", 0, 0)).toBe("RENDIRSE");
  });
});

describe("mensajeDeEstado", () => {
  it("explica cada respuesta de la ruta", () => {
    expect(mensajeDeEstado(402)).toMatch(/saldo/);
    expect(mensajeDeEstado(410)).toMatch(/ya no está/);
    expect(mensajeDeEstado(404)).toMatch(/preparando/);
    expect(mensajeDeEstado(null)).toMatch(/No se pudo/);
  });
});
