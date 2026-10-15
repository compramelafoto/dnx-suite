import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("./r2-client", () => ({
  isFotofficeR2Configured: () => true,
  getFotofficeR2PublicUrl: (key: string) => `https://cdn.example/${key}`,
  generateFotofficeR2Key: (name: string, prefix: string) => `${prefix}/fijo-${name}`,
  getFotofficeR2Client: () => ({ send: sendMock }),
  getFotofficeR2Bucket: () => "dnx",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: getSignedUrlMock }));

const { createFotofficeUploadUrl, verifyUploadedImage } = await import("./r2-presign");

const PREFIJO = "fotoffice/member-portfolio/ws-1";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe("createFotofficeUploadUrl", () => {
  beforeEach(() => {
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue("https://r2.example/firmada");
  });

  it("devuelve la URL firmada, la key y la dirección pública final", async () => {
    const r = await createFotofficeUploadUrl({
      prefix: PREFIJO,
      originalFilename: "obra.jpg",
      contentType: "image/jpeg",
    });
    expect(r.uploadUrl).toBe("https://r2.example/firmada");
    expect(r.key).toBe(`${PREFIJO}/fijo-obra.jpg`);
    expect(r.publicUrl).toBe(`https://cdn.example/${PREFIJO}/fijo-obra.jpg`);
  });

  it("rechaza un content-type que el servidor no sabe verificar, antes de firmar nada", async () => {
    await expect(
      createFotofficeUploadUrl({
        prefix: PREFIJO,
        originalFilename: "x.svg",
        contentType: "image/svg+xml",
      }),
    ).rejects.toThrow(/JPG, PNG o WebP/);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("rechaza firmar fuera del namespace de FotoOffice", async () => {
    await expect(
      createFotofficeUploadUrl({
        prefix: "albums/999",
        originalFilename: "robada.jpg",
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow();
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("la URL firmada vence: no queda un permiso de escritura abierto para siempre", async () => {
    await createFotofficeUploadUrl({
      prefix: PREFIJO,
      originalFilename: "obra.jpg",
      contentType: "image/jpeg",
    });
    const [, , opciones] = getSignedUrlMock.mock.calls[0];
    expect(opciones.expiresIn).toBeGreaterThan(0);
    expect(opciones.expiresIn).toBeLessThanOrEqual(300);
  });
});

describe("verifyUploadedImage", () => {
  beforeEach(() => sendMock.mockReset());

  const verificar = (key = `${PREFIJO}/a.jpg`) =>
    verifyUploadedImage({
      key,
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    });

  it("acepta un JPEG dentro del tope", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 1024 })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => JPEG } });
    expect(await verificar()).toEqual({ ok: true, sizeBytes: 1024, contentType: "image/jpeg" });
  });

  it("rechaza un objeto más grande que el tope, aunque el navegador dijera que no lo era", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 50 * 1024 * 1024 });
    const r = await verificar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("10 MB");
  });

  it("rechaza un archivo que no es una imagen, aunque se llame .jpg", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 100 })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => PDF } });
    const r = await verificar();
    expect(r.ok).toBe(false);
  });

  it("rechaza un formato válido que este preset no admite", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 100 })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => JPEG } });
    const r = await verifyUploadedImage({
      key: `${PREFIJO}/a.jpg`,
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/png"],
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza un objeto vacío", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 0 });
    const r = await verificar();
    expect(r.ok).toBe(false);
  });

  it("rechaza una key fuera del namespace de FotoOffice sin llegar a consultar R2", async () => {
    const r = await verificar("albums/999/robada.jpg");
    expect(r.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("lee sólo los primeros bytes: no baja la foto entera para mirarle la firma", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 5 * 1024 * 1024 })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => JPEG } });
    await verificar();
    const comandoDeLectura = sendMock.mock.calls[1][0];
    expect(comandoDeLectura.input.Range).toMatch(/^bytes=0-/);
  });
});
