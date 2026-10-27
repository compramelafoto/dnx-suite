import { describe, expect, it } from "vitest";
import { archivoDeMensaje, claveDeMedia } from "./archivo-de-mensaje";

describe("archivo de un mensaje de WhatsApp", () => {
  it("una imagen todavía sin bajar figura PENDIENTE con nombre genérico", () => {
    expect(archivoDeMensaje("IMAGEN", { id: "m1", mimeType: "image/jpeg" })).toEqual({
      estado: "PENDIENTE", mime: "image/jpeg", nombre: "foto.jpg", bytes: null, ancho: null, alto: null,
    });
  });

  it("una imagen bajada trae sus números y la clave sólo por claveDeMedia", () => {
    const media = { id: "m1", mimeType: "image/jpeg", descarga: "LISTO", clave: "bandeja/w/c/m.jpg", bytes: 1000, ancho: 1600, alto: 1200 };
    const a = archivoDeMensaje("IMAGEN", media);
    expect(a).toMatchObject({ estado: "LISTO", bytes: 1000, ancho: 1600, alto: 1200 });
    expect(a).not.toHaveProperty("clave");
    expect(claveDeMedia(media)).toBe("bandeja/w/c/m.jpg");
  });

  it("un documento conserva su nombre", () => {
    expect(archivoDeMensaje("DOCUMENTO", { id: "m1", filename: "foto original.jpg" })?.nombre).toBe("foto original.jpg");
  });

  it("si falló la descarga no hay clave", () => {
    const media = { id: "m1", descarga: "FALLO", clave: "bandeja/w/c/m.jpg" };
    expect(archivoDeMensaje("IMAGEN", media)?.estado).toBe("FALLO");
    expect(claveDeMedia(media)).toBeNull();
  });

  it("texto, ubicación o media sin id → null", () => {
    expect(archivoDeMensaje("TEXTO", { id: "m1" })).toBeNull();
    expect(archivoDeMensaje("UBICACION", { latitude: 1 })).toBeNull();
    expect(archivoDeMensaje("IMAGEN", { mimeType: "image/jpeg" })).toBeNull();
  });

  it("sin descarga: un eco o un mensaje viejo no figuran 'bajando'", () => {
    const ahora = new Date("2026-10-27T12:00:00.000Z");
    const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);
    const media = { id: "m1", mimeType: "image/jpeg" };
    expect(archivoDeMensaje("IMAGEN", media, { direccion: "SALIENTE", createdAt: hace(1), ahora })).toBeNull();
    expect(archivoDeMensaje("IMAGEN", media, { direccion: "ENTRANTE", createdAt: hace(11), ahora })?.estado).toBe("FALLO");
    expect(archivoDeMensaje("IMAGEN", media, { direccion: "ENTRANTE", createdAt: hace(2), ahora })?.estado).toBe("PENDIENTE");
    const listo = { ...media, descarga: "LISTO", clave: "k" };
    expect(archivoDeMensaje("IMAGEN", listo, { direccion: "ENTRANTE", createdAt: hace(60), ahora })?.estado).toBe("LISTO");
  });

  it("media basura no rompe", () => {
    expect(archivoDeMensaje("IMAGEN", "x")).toBeNull();
    expect(archivoDeMensaje("IMAGEN", null)).toBeNull();
    expect(archivoDeMensaje("IMAGEN", { id: "m1", ancho: "mil", bytes: -3 })).toMatchObject({ ancho: null, bytes: null });
    expect(claveDeMedia({ descarga: "LISTO", clave: 5 })).toBeNull();
  });
});
