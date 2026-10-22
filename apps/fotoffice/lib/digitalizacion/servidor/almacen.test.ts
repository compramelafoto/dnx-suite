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
    const { urlDeVideo } = await import("./almacen");
    const SEGUNDOS_VER_PUBLICO = 3 * 3600;
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

describe("playlistHlsFirmada", () => {
  const VOD = (n: number) =>
    `#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n${Array.from({ length: n }, (_, i) => `#EXTINF:6.0,\nseg_${String(i + 1).padStart(5, "0")}.ts\n`).join("")}#EXT-X-ENDLIST\n`;

  async function conPlaylist(texto: string | Error) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation((async () => {
      if (texto instanceof Error) throw texto;
      return { Body: { transformToString: async () => texto } };
    }) as never);
    return send;
  }
  afterEach(() => vi.restoreAllMocks());

  it("lee <hlsKey>/index.m3u8 y firma cada segmento con su clave, por 4 h como mucho", async () => {
    const send = await conPlaylist(VOD(2));
    const { playlistHlsFirmada } = await import("./almacen");
    const r = (await playlistHlsFirmada("digitalizacion/ws1/g1/hls", 10 * 3600))!;
    expect((send.mock.calls[0]![0] as { input: { Key: string; Bucket: string } }).input).toEqual({ Bucket: "privado-test", Key: "digitalizacion/ws1/g1/hls/index.m3u8" });
    const urls = r.split("\n").filter((l) => l.startsWith("https://"));
    expect(urls).toHaveLength(2);
    const u = new URL(urls[1]!);
    expect(u.pathname).toMatch(/\/digitalizacion\/ws1\/g1\/hls\/seg_00002\.ts$/);
    expect(u.searchParams.get("X-Amz-Expires")).toBe(String(4 * 3600));
    expect(r).toContain("#EXT-X-ENDLIST");
  });
  it("respeta una duración más corta (vencimiento cerca)", async () => {
    await conPlaylist(VOD(1));
    const { playlistHlsFirmada } = await import("./almacen");
    const r = (await playlistHlsFirmada("digitalizacion/ws1/g1/hls", 600))!;
    expect(new URL(r.split("\n").find((l) => l.startsWith("https://"))!).searchParams.get("X-Amz-Expires")).toBe("600");
  });
  it("sin playlist en R2, o con una que no es nuestra: null", async () => {
    await conPlaylist(Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }));
    const { playlistHlsFirmada } = await import("./almacen");
    expect(await playlistHlsFirmada("digitalizacion/ws1/g1/hls")).toBeNull();
    vi.restoreAllMocks();
    await conPlaylist(VOD(1).replace("seg_00001.ts", "../final.mp4"));
    expect(await playlistHlsFirmada("digitalizacion/ws1/g1/hls")).toBeNull();
  });
  it("rechaza prefijos con otra forma", async () => {
    const { playlistHlsFirmada } = await import("./almacen");
    await expect(playlistHlsFirmada("digitalizacion/ws1/g1/hls/")).rejects.toThrow();
    await expect(playlistHlsFirmada("otra/ws1/g1/hls")).rejects.toThrow();
    await expect(playlistHlsFirmada("digitalizacion/ws1/g1/../x")).rejects.toThrow();
  });
  it("una cinta de 2 h 20 min (1400 segmentos) se firma rápido", async () => {
    await conPlaylist(VOD(1400));
    const { playlistHlsFirmada } = await import("./almacen");
    const t0 = performance.now();
    const r = (await playlistHlsFirmada("digitalizacion/ws1/g1/hls"))!;
    const ms = performance.now() - t0;
    console.log(`1400 segmentos firmados en ${Math.round(ms)} ms, ${Math.round(r.length / 1024)} KB`);
    expect(r.split("\n").filter((l) => l.startsWith("https://"))).toHaveLength(1400);
    expect(ms).toBeLessThan(5000);
  });
});
