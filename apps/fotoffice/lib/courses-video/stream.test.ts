import { describe, expect, it, vi } from "vitest";
import { createDirectUpload, getVideoStatus, StreamError } from "./stream";

const config = {
  accountId: "cuenta",
  apiToken: "token",
  signingKeyId: "clave",
  signingKeyPem: "pem",
};

function respuesta(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("pedir una URL de subida", () => {
  it("exige firma para reproducir y limita los orígenes", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(respuesta({ result: { uid: "video-1", uploadURL: "https://subir" } }));

    const r = await createDirectUpload(
      { maxDurationSeconds: 7200 },
      { config, fetchImpl: fetchSimulado },
    );
    expect(r).toEqual({ uid: "video-1", uploadUrl: "https://subir" });

    const [url, init] = fetchSimulado.mock.calls[0];
    expect(String(url)).toContain("/accounts/cuenta/stream/direct_upload");
    const cuerpo = JSON.parse(String((init as RequestInit).body));
    // Sin esto, el enlace del video sirve en cualquier lado: es la base de la protección.
    expect(cuerpo.requireSignedURLs).toBe(true);
    expect(cuerpo.allowedOrigins).toContain("fotoffice.com");
    expect(cuerpo.maxDurationSeconds).toBe(7200);
  });

  it("si el proveedor rechaza, avisa sin filtrar el token", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(respuesta({ errors: [{ message: "sin permiso" }] }, false, 403));

    await expect(
      createDirectUpload({ maxDurationSeconds: 60 }, { config, fetchImpl: fetchSimulado }),
    ).rejects.toBeInstanceOf(StreamError);

    await expect(
      createDirectUpload({ maxDurationSeconds: 60 }, { config, fetchImpl: fetchSimulado }),
    ).rejects.not.toThrow(/token/);
  });
});

describe("estado del video", () => {
  it("traduce el estado del proveedor al nuestro", async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(
      respuesta({
        result: { status: { state: "ready" }, duration: 612.4, thumbnail: "https://miniatura" },
      }),
    );
    const r = await getVideoStatus("video-1", { config, fetchImpl: fetchSimulado });
    expect(r).toEqual({
      status: "READY",
      durationSeconds: 612,
      thumbnailUrl: "https://miniatura",
    });
  });

  it("mientras procesa no informa duración", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(respuesta({ result: { status: { state: "inprogress" } } }));
    const r = await getVideoStatus("video-1", { config, fetchImpl: fetchSimulado });
    expect(r).toEqual({ status: "PROCESSING", durationSeconds: null, thumbnailUrl: null });
  });

  it("un estado desconocido no se toma por listo", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(respuesta({ result: { status: { state: "loquesea" } } }));
    const r = await getVideoStatus("video-1", { config, fetchImpl: fetchSimulado });
    expect(r.status).toBe("PROCESSING");
  });

  it("el error del proveedor se informa como error del video", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(respuesta({ result: { status: { state: "error" } } }));
    const r = await getVideoStatus("video-1", { config, fetchImpl: fetchSimulado });
    expect(r.status).toBe("ERROR");
  });
});
