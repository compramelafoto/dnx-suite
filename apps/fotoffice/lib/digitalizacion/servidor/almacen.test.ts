import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.stubEnv("R2_ACCOUNT_ID", "acc");
  vi.stubEnv("R2_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-test");
  vi.stubEnv("R2_ENDPOINT", "https://acc.r2.cloudflarestorage.com");
  vi.stubEnv("R2_PRIVATE_BUCKET", "privado-test");
});
afterEach(() => vi.unstubAllEnvs());

describe("urlDeSubidaParte", () => {
  it("no firma el checksum de un cuerpo vacío y firma content-length y content-type", async () => {
    const { urlDeSubidaParte } = await import("./almacen");
    const url = await urlDeSubidaParte("digitalizacion/ws1/g1/t1/000003.webm", "video/webm", 10);
    expect(url).not.toMatch(/x-amz-checksum/i);
    expect(url).not.toMatch(/x-amz-sdk-checksum-algorithm/i);
    expect(new URL(url).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  });
});

describe("urlDeVideo", () => {
  it("firma sólo claves digitalizacion/<ws>/<id>/final.mp4", async () => {
    const { urlDeVideo } = await import("./almacen");
    expect(await urlDeVideo("digitalizacion/ws1/g1/final.mp4", "a.mp4", "ver")).toMatch(/response-content-disposition=inline/);
    await expect(urlDeVideo("otra/ws1/g1/final.mp4", "a.mp4", "ver")).rejects.toThrow();
    await expect(urlDeVideo("digitalizacion/ws1/g1/t1/000001.webm", "a.mp4", "ver")).rejects.toThrow();
    await expect(urlDeVideo("digitalizacion/ws1/g1/final.mp4.x", "a.mp4", "ver")).rejects.toThrow();
  });
});

describe("urlDeVideo con duración", () => {
  it("la página pública firma más corto; nunca más de 24 h", async () => {
    const { urlDeVideo, SEGUNDOS_VER_PUBLICO } = await import("./almacen");
    const corta = new URL(await urlDeVideo("digitalizacion/ws1/g1/final.mp4", "a.mp4", "ver", SEGUNDOS_VER_PUBLICO));
    expect(corta.searchParams.get("X-Amz-Expires")).toBe(String(SEGUNDOS_VER_PUBLICO));
    const larga = new URL(await urlDeVideo("digitalizacion/ws1/g1/final.mp4", "a.mp4", "descargar", 10 * 24 * 3600));
    expect(larga.searchParams.get("X-Amz-Expires")).toBe(String(24 * 3600));
    expect(larga.searchParams.get("response-content-disposition")).toMatch(/^attachment/);
  });
});

describe("borrarVideoFinal", () => {
  it("rechaza claves fuera de la carpeta de la grabación sin tocar R2", async () => {
    const { borrarVideoFinal } = await import("./almacen");
    await expect(borrarVideoFinal("digitalizacion/ws1/g1/", "digitalizacion/ws1/OTRA/final.mp4", null)).rejects.toThrow();
    await expect(borrarVideoFinal("digitalizacion/ws1/g1/", null, "digitalizacion/ws1/OTRA/hls")).rejects.toThrow();
    await expect(borrarVideoFinal("digitalizacion/ws1/g1/", null, "digitalizacion/ws1/g1/../../x")).rejects.toThrow();
    await expect(borrarVideoFinal("otra/ws1/g1/", null, null)).rejects.toThrow();
  });
});
