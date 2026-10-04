import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createDirectUpload,
  getVideoStatus,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "./stream";

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

describe("permiso de reproducción", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const configFirma = { ...config, signingKeyId: "clave-firma", signingKeyPem: pem };
  const ahora = new Date(Date.UTC(2026, 9, 3, 12));

  function partes(token: string) {
    const [h, p, f] = token.split(".");
    return {
      header: JSON.parse(Buffer.from(h, "base64url").toString()),
      payload: JSON.parse(Buffer.from(p, "base64url").toString()),
      firmado: `${h}.${p}`,
      firma: Buffer.from(f, "base64url"),
    };
  }

  it("firma un token para un solo video, que vence", () => {
    const token = signPlaybackToken(
      { videoUid: "video-1", ttlSeconds: 7200, ahora },
      { config: configFirma },
    );
    const { header, payload, firmado, firma } = partes(token);
    expect(header).toEqual({ alg: "RS256", kid: "clave-firma" });
    expect(payload.sub).toBe("video-1");
    expect(payload.kid).toBe("clave-firma");
    expect(payload.exp).toBe(Math.floor(ahora.getTime() / 1000) + 7200);
    expect(createVerify("RSA-SHA256").update(firmado).verify(publicKey, firma)).toBe(true);
  });

  it("acepta la clave tal como la entrega Cloudflare, en base64", () => {
    const enBase64 = Buffer.from(pem).toString("base64");
    const token = signPlaybackToken(
      { videoUid: "video-1", ttlSeconds: 60, ahora },
      { config: { ...configFirma, signingKeyPem: enBase64 } },
    );
    const { firmado, firma } = partes(token);
    expect(createVerify("RSA-SHA256").update(firmado).verify(publicKey, firma)).toBe(true);
  });

  it("sin configuración lanza StreamError, sin datos de la clave en el mensaje", () => {
    const previo = process.env.STREAM_SIGNING_KEY_PEM;
    delete process.env.STREAM_SIGNING_KEY_PEM;
    try {
      expect(() => signPlaybackToken({ videoUid: "v", ttlSeconds: 60 })).toThrow(StreamError);
    } finally {
      if (previo !== undefined) process.env.STREAM_SIGNING_KEY_PEM = previo;
    }
  });

  it("la dirección del reproductor lleva el token y desde dónde arrancar", () => {
    expect(playbackIframeUrl("tok")).toBe("https://iframe.videodelivery.net/tok");
    expect(playbackIframeUrl("tok", { startSeconds: 140.7 })).toBe(
      "https://iframe.videodelivery.net/tok?startTime=140s",
    );
  });
});
