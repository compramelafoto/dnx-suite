import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchImageAsDataUrl, toAbsoluteAssetUrl } from "./remote-image";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function okResponse(body: Buffer, contentType = "image/png"): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

describe("toAbsoluteAssetUrl", () => {
  it("resuelve rutas relativas contra la base", () => {
    assert.equal(
      toAbsoluteAssetUrl("/api/media/clickaton/logo.png", "https://clickaton.com/"),
      "https://clickaton.com/api/media/clickaton/logo.png"
    );
  });

  it("devuelve null si es relativa y no hay base", () => {
    assert.equal(toAbsoluteAssetUrl("/api/media/logo.png", ""), null);
    assert.equal(toAbsoluteAssetUrl("/api/media/logo.png"), null);
  });

  it("deja pasar https y data URLs", () => {
    assert.equal(toAbsoluteAssetUrl("https://cdn.io/a.png"), "https://cdn.io/a.png");
    assert.equal(toAbsoluteAssetUrl("data:image/png;base64,AAA"), "data:image/png;base64,AAA");
  });
});

describe("fetchImageAsDataUrl", () => {
  it("descarga y embebe una imagen https", async () => {
    const result = await fetchImageAsDataUrl("https://cdn.io/logo.png", {
      fetchImpl: async () => okResponse(PNG_BYTES),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mimeType, "image/png");
    assert.ok(result.dataUrl.startsWith("data:image/png;base64,"));
    assert.equal(result.byteSize, PNG_BYTES.length);
  });

  it("resuelve una ruta de proxy relativa usando baseUrl", async () => {
    let requested = "";
    const result = await fetchImageAsDataUrl("/api/media/clickaton/logo.png", {
      baseUrl: "https://clickaton.com",
      fetchImpl: async (input) => {
        requested = String(input);
        return okResponse(PNG_BYTES);
      },
    });
    assert.equal(result.ok, true);
    assert.equal(requested, "https://clickaton.com/api/media/clickaton/logo.png");
  });

  it("rechaza hosts privados (SSRF)", async () => {
    const result = await fetchImageAsDataUrl("http://127.0.0.1/logo.png", {
      fetchImpl: async () => okResponse(PNG_BYTES),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /privado|SSRF/i);
  });

  it("rechaza formatos no admitidos", async () => {
    const result = await fetchImageAsDataUrl("https://cdn.io/logo.svg", {
      fetchImpl: async () => okResponse(PNG_BYTES, "image/svg+xml"),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /formato no admitido/i);
  });

  it("rechaza imágenes que superan el límite de bytes", async () => {
    const result = await fetchImageAsDataUrl("https://cdn.io/logo.png", {
      maxBytes: 10,
      fetchImpl: async () => okResponse(Buffer.alloc(64, 1)),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /pesada/i);
  });

  it("informa el error cuando el origen responde mal", async () => {
    const result = await fetchImageAsDataUrl("https://cdn.io/logo.png", {
      fetchImpl: async () => new Response(null, { status: 404 }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /HTTP 404/);
  });

  it("sin URL devuelve motivo explícito y no rompe", async () => {
    const result = await fetchImageAsDataUrl(null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /sin URL/i);
  });
});
