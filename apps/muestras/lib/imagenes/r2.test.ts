import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
}));

import { leerDeR2 } from "./r2";

const base = "https://cdn.test";
beforeEach(() => {
  send.mockReset();
  vi.stubEnv("R2_ACCESS_KEY_ID", "a");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "b");
  vi.stubEnv("R2_BUCKET_NAME", "bk");
  vi.stubEnv("R2_PUBLIC_URL", base);
  vi.stubEnv("R2_ENDPOINT", "https://e.test");
});

describe("leerDeR2", () => {
  it.each([
    ["otro host", "https://evil.test/muestras/a.webp"],
    ["fuera de muestras/", `${base}/fotoffice/a.webp`],
    ["con ..", `${base}/muestras/../fotoffice/a.webp`],
    ["con query", `${base}/muestras/a.webp?x=1`],
  ])("rechaza %s sin tocar el bucket", async (_n, url) => {
    expect(await leerDeR2(url)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
  it("lee una clave propia", async () => {
    send.mockResolvedValue({ Body: { transformToWebStream: () => "stream" }, ContentType: "image/webp" });
    expect(await leerDeR2(`${base}/muestras/obras/1/a.webp`)).toEqual({ cuerpo: "stream", contentType: "image/webp" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
