import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_ACCESS_KEY_ID = "AKIATEST";
  process.env.R2_SECRET_ACCESS_KEY = "secret-test";
  process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
  process.env.R2_PRIVATE_BUCKET = "privado-test";
});

describe("urlDeSubidaParte", () => {
  it("no firma el checksum de un cuerpo vacío y firma content-length y content-type", async () => {
    const { urlDeSubidaParte } = await import("./almacen");
    const url = await urlDeSubidaParte("digitalizacion/ws1/g1/t1/000003.webm", "video/webm", 10);
    expect(url).not.toMatch(/x-amz-checksum/i);
    expect(url).not.toMatch(/x-amz-sdk-checksum-algorithm/i);
    expect(new URL(url).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  });
});
