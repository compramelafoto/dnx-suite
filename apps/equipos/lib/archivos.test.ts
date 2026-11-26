import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: m.send };
  }),
  PutObjectCommand: vi.fn(function (input: unknown) {
    return { kind: "put", input };
  }),
  GetObjectCommand: vi.fn(function (input: unknown) {
    return { kind: "get", input };
  }),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: m.sign }));

import { getSignedFileUrl, MAX_FILE_BYTES, uploadPrivateFile, validateFile } from "./archivos";

function file(type: string, size = 10): File {
  return new File([new Uint8Array(size)], "x", { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.R2_ACCOUNT_ID = "a";
  process.env.R2_ACCESS_KEY_ID = "k";
  process.env.R2_SECRET_ACCESS_KEY = "s";
  process.env.R2_ENDPOINT = "https://x.r2.cloudflarestorage.com";
  process.env.R2_BUCKET_NAME = "bucket";
  m.send.mockResolvedValue({});
  m.sign.mockResolvedValue("https://firmada");
});

describe("validateFile", () => {
  it("comprobante: acepta jpeg/png/webp/pdf y rechaza el resto", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(validateFile(file(t), "proof")).toBeNull();
    }
    expect(validateFile(file("image/gif"), "proof")).toMatch(/Formato/);
  });
  it("foto: no acepta PDF", () => {
    expect(validateFile(file("application/pdf"), "photo")).toMatch(/Formato/);
    expect(validateFile(file("image/webp"), "photo")).toBeNull();
  });
  it("rechaza más de 4 MB", () => {
    expect(validateFile({ type: "image/png", size: MAX_FILE_BYTES + 1 }, "photo")).toMatch(/4 MB/);
    expect(validateFile({ type: "image/png", size: MAX_FILE_BYTES }, "photo")).toBeNull();
  });
});

describe("uploadPrivateFile", () => {
  it("sube con prefijo equipos/ y nombre aleatorio", async () => {
    const r = await uploadPrivateFile(file("application/pdf"), "proof");
    expect(r.key).toMatch(/^equipos\/[0-9a-f-]{36}\.pdf$/);
    expect(r.mime).toBe("application/pdf");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send.mock.calls[0][0].input).toMatchObject({ Bucket: "bucket", Key: r.key });
  });
  it("no sube un archivo inválido", async () => {
    await expect(uploadPrivateFile(file("image/gif"), "photo")).rejects.toThrow(/Formato/);
    expect(m.send).not.toHaveBeenCalled();
  });
});

describe("getSignedFileUrl", () => {
  it("firma la lectura de una clave propia", async () => {
    await expect(getSignedFileUrl("equipos/abc.jpg")).resolves.toBe("https://firmada");
    expect(m.sign.mock.calls[0][2]).toEqual({ expiresIn: 900 });
  });
  it("rechaza claves de otro prefijo", async () => {
    await expect(getSignedFileUrl("stolen-gear/abc.jpg")).rejects.toThrow();
    expect(m.sign).not.toHaveBeenCalled();
  });
});
