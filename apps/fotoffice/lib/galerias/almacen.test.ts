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
  return {
    S3Client,
    PutObjectCommand: class PutObjectCommand extends Cmd {},
    GetObjectCommand: class GetObjectCommand extends Cmd {},
    HeadObjectCommand: class HeadObjectCommand extends Cmd {},
    DeleteObjectCommand: class DeleteObjectCommand extends Cmd {},
  };
});
process.env.R2_ACCOUNT_ID = "acc";
process.env.R2_ACCESS_KEY_ID = "id";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
process.env.R2_BUCKET_NAME = "publico";
process.env.R2_PRIVATE_BUCKET = "privado";

const A = await import("./almacen");
const ORIG = "galerias/ws1/g1/f1/original";
const VISTA = "galerias/ws1/g1/f1/vista.jpg";
const MINI = "galerias/ws1/g1/f1/mini.jpg";

beforeEach(() => {
  H.firmar.mockReset().mockImplementation(async (_c: unknown, cmd: { input: { Key: string } }) => `https://firmada/${cmd.input.Key}`);
  H.send.mockReset();
});

describe("urlDeSubidaFoto", () => {
  it("firma un PUT de 15 minutos con tipo y largo dentro de la firma, en el bucket privado", async () => {
    await A.urlDeSubidaFoto(ORIG, "image/jpeg", 1234);
    const [, cmd, opts] = H.firmar.mock.calls[0];
    expect(cmd.constructor.name).toBe("PutObjectCommand");
    expect(cmd.input).toEqual({ Bucket: "privado", Key: ORIG, ContentType: "image/jpeg", ContentLength: 1234 });
    expect(opts.expiresIn).toBe(900);
    expect([...opts.signableHeaders].sort()).toEqual(["content-length", "content-type"]);
  });
  it("rechaza tipos, tamaños (más de 50 MB) y claves que no corresponden", async () => {
    await expect(A.urlDeSubidaFoto(ORIG, "image/webp", 10)).rejects.toThrow();
    await expect(A.urlDeSubidaFoto(ORIG, "image/png", 52_428_801)).rejects.toThrow();
    await expect(A.urlDeSubidaFoto(ORIG, "image/png", 0)).rejects.toThrow();
    await expect(A.urlDeSubidaFoto(VISTA, "image/png", 10)).rejects.toThrow();
    await expect(A.urlDeSubidaFoto("adjuntos/ws1/x", "image/png", 10)).rejects.toThrow();
    expect((await A.urlDeSubidaFoto(ORIG, "image/png", 52_428_800)).length).toBeGreaterThan(0);
  });
});

describe("urlDeLecturaFoto", () => {
  it("GET inline por 1 hora, solo de vista y miniatura", async () => {
    await A.urlDeLecturaFoto(MINI);
    const [, cmd, opts] = H.firmar.mock.calls[0];
    expect(cmd.constructor.name).toBe("GetObjectCommand");
    expect(cmd.input).toEqual({ Bucket: "privado", Key: MINI, ResponseContentDisposition: "inline" });
    expect(opts.expiresIn).toBe(3600);
    await expect(A.urlDeLecturaFoto(ORIG)).rejects.toThrow();
  });
  it("por lote: una URL por foto y null si falla una clave", async () => {
    const m = await A.urlsDeLecturaPorLote([
      { id: "f1", viewKey: VISTA, thumbKey: MINI },
      { id: "f2", viewKey: null, thumbKey: "galerias/ws1/g1/f2/original" },
      { id: "f3", viewKey: null, thumbKey: null },
    ]);
    expect(m.get("f1")).toEqual({ thumbUrl: `https://firmada/${MINI}`, viewUrl: `https://firmada/${VISTA}` });
    expect(m.get("f2")).toEqual({ thumbUrl: null, viewUrl: null });
    expect(m.get("f3")).toEqual({ thumbUrl: null, viewUrl: null });
  });
});

describe("objetos", () => {
  it("tamanoDeObjeto devuelve el largo, o null si no existe", async () => {
    H.send.mockResolvedValueOnce({ ContentLength: 99 });
    expect(await A.tamanoDeObjeto(ORIG)).toBe(99);
    expect(H.send.mock.calls[0][0].constructor.name).toBe("HeadObjectCommand");
    H.send.mockRejectedValueOnce({ name: "NotFound" });
    expect(await A.tamanoDeObjeto(ORIG)).toBeNull();
    H.send.mockRejectedValueOnce(new Error("boom"));
    await expect(A.tamanoDeObjeto(ORIG)).rejects.toThrow("boom");
  });
  it("leerObjeto devuelve un Buffer; guardarObjeto manda tipo y cuerpo", async () => {
    H.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } });
    expect([...(await A.leerObjeto(ORIG))]).toEqual([1, 2, 3]);
    await A.guardarObjeto(VISTA, Buffer.from("abc"), "image/jpeg");
    expect(H.send.mock.calls[1][0].input).toMatchObject({ Bucket: "privado", Key: VISTA, ContentType: "image/jpeg", ContentLength: 3 });
  });
  it("borrarObjetoFoto ignora no encontrado y propaga lo demás", async () => {
    H.send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    await expect(A.borrarObjetoFoto(MINI)).resolves.toBeUndefined();
    expect(H.send.mock.calls[0][0].input).toEqual({ Bucket: "privado", Key: MINI });
    H.send.mockRejectedValueOnce(new Error("x"));
    await expect(A.borrarObjetoFoto(MINI)).rejects.toThrow("x");
  });
  it("nunca toca claves fuera del formato de galería", async () => {
    await expect(A.tamanoDeObjeto("galerias/ws1/../x/original")).rejects.toThrow();
    await expect(A.borrarObjetoFoto("adjuntos/ws1/uuid")).rejects.toThrow();
    expect(H.send).not.toHaveBeenCalled();
  });
});
