import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ firmar: vi.fn(), send: vi.fn(), clientes: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: H.firmar }));
vi.mock("@aws-sdk/client-s3", () => {
  class Cmd {
    constructor(public input: Record<string, unknown>) {}
  }
  class S3Client {
    constructor(public config: unknown) {
      H.clientes.push(config);
    }
    send = H.send;
  }
  return {
    S3Client,
    PutObjectCommand: class extends Cmd {},
    GetObjectCommand: class extends Cmd {},
    HeadObjectCommand: class extends Cmd {},
    DeleteObjectCommand: class extends Cmd {},
  };
});

process.env.R2_ACCOUNT_ID = "acc";
process.env.R2_ACCESS_KEY_ID = "id";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
process.env.R2_BUCKET_NAME = "publico";
process.env.R2_PRIVATE_BUCKET = "privado";

const R = await import("./adjuntos-r2");
const CLAVE = "adjuntos/ws1/123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  H.firmar.mockReset().mockResolvedValue("https://firmada");
  H.send.mockReset();
});

describe("adjuntosR2Configurado", () => {
  it("exige R2_PRIVATE_BUCKET además de las credenciales", () => {
    expect(R.adjuntosR2Configurado()).toBe(true);
    const antes = process.env.R2_PRIVATE_BUCKET;
    delete process.env.R2_PRIVATE_BUCKET;
    expect(R.adjuntosR2Configurado()).toBe(false);
    process.env.R2_PRIVATE_BUCKET = antes;
  });
});

describe("urlDeSubida", () => {
  it("PUT al bucket privado, tipo y tamaño fijados, vence en 600", async () => {
    expect(await R.urlDeSubida(CLAVE, "application/pdf", 1234)).toBe("https://firmada");
    const [, cmd, opts] = H.firmar.mock.calls[0];
    expect(cmd.constructor.name).not.toBe("GetObjectCommand");
    expect(cmd.input).toEqual({ Bucket: "privado", Key: CLAVE, ContentType: "application/pdf", ContentLength: 1234 });
    expect(opts.expiresIn).toBe(600);
    expect([...opts.signableHeaders]).toEqual(["content-type", "content-length"]);
  });
  it("rechaza tipo o tamaño fuera de regla y claves fuera del namespace", async () => {
    await expect(R.urlDeSubida(CLAVE, "text/html", 10)).rejects.toThrow();
    await expect(R.urlDeSubida(CLAVE, "application/pdf", 10_485_761)).rejects.toThrow();
    await expect(R.urlDeSubida("fotoffice/otra", "application/pdf", 10)).rejects.toThrow();
    expect(H.firmar).not.toHaveBeenCalled();
  });
});

describe("urlDeDescarga", () => {
  it("GET al bucket privado, 300 s, como descarga con nombre codificado", async () => {
    await R.urlDeDescarga(CLAVE, "DNI de Pérez (frente).pdf");
    const [, cmd, opts] = H.firmar.mock.calls[0];
    expect(cmd.input.Bucket).toBe("privado");
    expect(cmd.input.Key).toBe(CLAVE);
    expect(cmd.input.ResponseContentDisposition).toBe(
      "attachment; filename*=UTF-8''DNI%20de%20P%C3%A9rez%20%28frente%29.pdf",
    );
    expect(opts.expiresIn).toBe(300);
  });
});

describe("tamanoReal / borrarObjeto", () => {
  it("HEAD devuelve el tamaño del bucket privado", async () => {
    H.send.mockResolvedValue({ ContentLength: 99 });
    expect(await R.tamanoReal(CLAVE)).toBe(99);
    expect(H.send.mock.calls[0][0].input).toEqual({ Bucket: "privado", Key: CLAVE });
  });
  it("HEAD de algo que no existe → null", async () => {
    H.send.mockRejectedValue({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    expect(await R.tamanoReal(CLAVE)).toBeNull();
  });
  it("HEAD con otro error lo propaga", async () => {
    H.send.mockRejectedValue(new Error("red"));
    await expect(R.tamanoReal(CLAVE)).rejects.toThrow("red");
  });
  it("borrar es idempotente y usa el bucket privado", async () => {
    H.send.mockRejectedValueOnce({ name: "NoSuchKey" });
    await expect(R.borrarObjeto(CLAVE)).resolves.toBeUndefined();
    expect(H.send.mock.calls[0][0].input).toEqual({ Bucket: "privado", Key: CLAVE });
  });
  it("nunca se usa el bucket público", () => {
    const todos = [...H.firmar.mock.calls, ...H.send.mock.calls].map((c) => JSON.stringify(c));
    expect(todos.join()).not.toContain("publico");
  });
});
