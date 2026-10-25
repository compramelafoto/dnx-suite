import { describe, expect, it } from "vitest";
import { accionAnteError, mensajeDeEstado, modoDeReproduccion } from "./reproductor";

describe("modoDeReproduccion", () => {
  it("hls.js siempre que haya Media Source; nativo sólo sin él; si no hay ninguno, no se puede", () => {
    // Chrome 152 dice "maybe" y su HLS propio falla con la playlist firmada: tiene que ir por hls.js.
    expect(modoDeReproduccion("maybe", true)).toBe("HLSJS");
    expect(modoDeReproduccion("probably", true)).toBe("HLSJS");
    expect(modoDeReproduccion("", true)).toBe("HLSJS");
    expect(modoDeReproduccion("probably", false)).toBe("NATIVO");
    expect(modoDeReproduccion("maybe", false)).toBe("NATIVO");
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
