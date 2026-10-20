import { describe, expect, it } from "vitest";
import { claveDeParte, esClaveDeParte, extensionDeMime, prefijoDeGrabacion, tipoContenido } from "./claves";

describe("claves de digitalización", () => {
  it("arma la clave con tramo e índice de 6 dígitos", () => {
    expect(claveDeParte({ workspaceId: "ws_1", grabacionId: "g1", tramo: 2, indice: 37, extension: "mp4" }))
      .toBe("digitalizacion/ws_1/g1/t2/000037.mp4");
  });
  it("rechaza ids, tramos e índices fuera de rango", () => {
    expect(() => claveDeParte({ workspaceId: "../x", grabacionId: "g1", tramo: 1, indice: 0, extension: "mp4" })).toThrow();
    expect(() => claveDeParte({ workspaceId: "w", grabacionId: "g1", tramo: 0, indice: 0, extension: "mp4" })).toThrow();
    expect(() => claveDeParte({ workspaceId: "w", grabacionId: "g1", tramo: 1, indice: 1_000_000, extension: "mp4" })).toThrow();
  });
  it("reconoce sólo claves propias", () => {
    expect(esClaveDeParte("digitalizacion/w/g/t1/000000.webm")).toBe(true);
    expect(esClaveDeParte("fotoffice/member-portfolio/x.jpg")).toBe(false);
    expect(esClaveDeParte("digitalizacion/w/g/t1/000000.exe")).toBe(false);
  });
  it("traduce el mime de MediaRecorder y el de DVD", () => {
    expect(extensionDeMime("video/mp4;codecs=avc1,mp4a.40.2")).toBe("mp4");
    expect(extensionDeMime("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(extensionDeMime("video/dvd")).toBe("vob");
    expect(extensionDeMime("image/png")).toBeNull();
    expect(tipoContenido("vob")).toBe("application/octet-stream");
    expect(tipoContenido("mp4")).toBe("video/mp4");
  });
  it("el prefijo de una grabación termina en barra", () => {
    expect(prefijoDeGrabacion("w", "g")).toBe("digitalizacion/w/g/");
  });
});
