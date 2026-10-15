import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ firmar: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: H.firmar }));
vi.mock("@aws-sdk/client-s3", () => {
  class Cmd {
    constructor(public input: Record<string, unknown>) {}
  }
  class S3Client {
    constructor(public config: unknown) {}
    send = H.send;
  }
  const c = (nombre: string) => ({ [nombre]: class extends Cmd {} })[nombre]!;
  return {
    S3Client,
    GetObjectCommand: c("GetObjectCommand"),
    PutObjectCommand: c("PutObjectCommand"),
    HeadObjectCommand: c("HeadObjectCommand"),
    DeleteObjectCommand: c("DeleteObjectCommand"),
    CreateMultipartUploadCommand: c("CreateMultipartUploadCommand"),
    UploadPartCommand: c("UploadPartCommand"),
    CompleteMultipartUploadCommand: c("CompleteMultipartUploadCommand"),
    AbortMultipartUploadCommand: c("AbortMultipartUploadCommand"),
  };
});
process.env.R2_ACCOUNT_ID = "acc";
process.env.R2_ACCESS_KEY_ID = "id";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
process.env.R2_BUCKET_NAME = "publico";
process.env.R2_PRIVATE_BUCKET = "privado";

const A = await import("./almacen-descargas");
const ORIG = "galerias/ws1/g1/f1/original";
const PARTE = "galerias/ws1/g1/descargas/d1/parte-1.zip";
const nombre = (cmd: unknown) => (cmd as { constructor: { name: string } }).constructor.name;

beforeEach(() => {
  H.firmar.mockReset().mockImplementation(async (_c: unknown, cmd: { input: { Key: string } }) => `https://firmada/${cmd.input.Key}`);
  H.send.mockReset();
});

describe("subida multiparte al bucket privado", () => {
  it("inicia, sube bloques numerados, completa en orden y devuelve las etiquetas", async () => {
    H.send.mockResolvedValueOnce({ UploadId: "up1" }).mockResolvedValueOnce({ ETag: '"e1"' }).mockResolvedValueOnce({});
    const id = await A.almacenZipR2.iniciarMultiparte(PARTE, "application/zip");
    expect(id).toBe("up1");
    expect(H.send.mock.calls[0]![0].input).toEqual({ Bucket: "privado", Key: PARTE, ContentType: "application/zip" });
    const etag = await A.almacenZipR2.subirBloque(PARTE, "up1", 1, Buffer.alloc(10));
    expect(etag).toBe('"e1"');
    expect(H.send.mock.calls[1]![0].input).toMatchObject({ Bucket: "privado", Key: PARTE, UploadId: "up1", PartNumber: 1, ContentLength: 10 });
    await A.almacenZipR2.completarMultiparte(PARTE, "up1", [{ numero: 1, etag: '"e1"' }]);
    expect(nombre(H.send.mock.calls[2]![0])).toBe("CompleteMultipartUploadCommand");
    expect(H.send.mock.calls[2]![0].input.MultipartUpload).toEqual({ Parts: [{ PartNumber: 1, ETag: '"e1"' }] });
  });
  it("rechaza claves que no son de la galería antes de tocar el bucket", async () => {
    await expect(A.almacenZipR2.iniciarMultiparte("adjuntos/otra/cosa.zip", "application/zip")).rejects.toThrow();
    await expect(A.almacenZipR2.borrar("../../x")).rejects.toThrow();
    expect(H.send).not.toHaveBeenCalled();
  });
  it("abortar una subida que ya no existe no es un error", async () => {
    H.send.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NoSuchUpload" }));
    await expect(A.almacenZipR2.abortarMultiparte(PARTE, "up1")).resolves.toBeUndefined();
    H.send.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "InternalError" }));
    await expect(A.almacenZipR2.abortarMultiparte(PARTE, "up1")).rejects.toThrow();
  });
  it("leer un original que no existe da null; el que existe, su flujo", async () => {
    H.send.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }));
    expect(await A.almacenZipR2.leer(ORIG)).toBeNull();
    const cuerpo = (async function* () { yield new Uint8Array(3); })();
    H.send.mockResolvedValueOnce({ Body: cuerpo });
    expect(await A.almacenZipR2.leer(ORIG)).toBe(cuerpo);
  });
  it("borrar es idempotente", async () => {
    H.send.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }));
    await expect(A.almacenZipR2.borrar(PARTE)).resolves.toBeUndefined();
  });
});

describe("urlDeDescargaParte", () => {
  it("firma un GET de 5 minutos, attachment y application/zip, sólo de una parte", async () => {
    await A.urlDeDescargaParte(PARTE, "Boda ñ-parte-1.zip");
    const [, cmd, opts] = H.firmar.mock.calls[0]!;
    expect(cmd.input).toMatchObject({ Bucket: "privado", Key: PARTE, ResponseContentType: "application/zip" });
    expect(cmd.input.ResponseContentDisposition).toBe('attachment; filename="Boda n-parte-1.zip"');
    expect(opts.expiresIn).toBe(300);
  });
  it("rechaza originales, vistas y claves raras", async () => {
    await expect(A.urlDeDescargaParte(ORIG, "x.zip")).rejects.toThrow();
    await expect(A.urlDeDescargaParte("galerias/ws1/g1/descargas/d1/../parte-1.zip", "x.zip")).rejects.toThrow();
    expect(H.firmar).not.toHaveBeenCalled();
  });
});
