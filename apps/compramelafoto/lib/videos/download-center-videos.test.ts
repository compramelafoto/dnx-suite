import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDownloadCenterVideos } from "./download-center-videos";

const base = {
  accessToken: "tok123",
  baseUrl: "https://www.compramelafoto.com",
};

function item(over: Record<string, unknown> = {}) {
  return {
    videoId: 21,
    videoTitle: "Ceremonia",
    video: {
      id: 21,
      originalKey: "albums/9/videos/original/abc.mp4",
      durationSeconds: 720,
      thumbnailKey: "albums/9/videos/thumbnail/21.jpg",
    },
    ...over,
  };
}

describe("videos en la pantalla de comprados", () => {
  it("arma el link de descarga con el token del pedido", () => {
    const [v] = buildDownloadCenterVideos([item()], base);
    assert.equal(v!.downloadUrl, "https://www.compramelafoto.com/api/descargas/tok123/videos/21");
  });

  it("usa el título que el cliente compró, no el actual", () => {
    // El video se borra a los 15 días; el título guardado en el pedido queda.
    const [v] = buildDownloadCenterVideos([item({ videoTitle: "Casamiento Ana" })], base);
    assert.equal(v!.title, "Casamiento Ana");
  });

  it("si no había título, muestra algo legible igual", () => {
    const [v] = buildDownloadCenterVideos([item({ videoTitle: null })], base);
    assert.ok(v!.title.length > 0);
    assert.ok(!v!.title.includes("null"));
  });

  it("muestra la duración en minutos y segundos", () => {
    const [v] = buildDownloadCenterVideos([item()], base);
    assert.equal(v!.durationLabel, "12:00");
  });

  it("avisa cuando el archivo ya se borró por los 15 días", () => {
    const [v] = buildDownloadCenterVideos(
      [item({ video: { ...item().video, originalKey: "__purged__" } })],
      base
    );
    assert.equal(v!.available, false);
    assert.equal(v!.downloadUrl, null);
    assert.match(v!.unavailableReason!, /15 días|ya no/i);
  });

  it("un video borrado de la base no rompe la pantalla", () => {
    const out = buildDownloadCenterVideos([item({ video: null })], base);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.available, false);
  });

  it("sin videos devuelve lista vacía", () => {
    assert.deepEqual(buildDownloadCenterVideos([], base), []);
  });

  it("sin baseUrl arma un link relativo, que igual funciona", () => {
    const [v] = buildDownloadCenterVideos([item()], { accessToken: "tok123" });
    assert.equal(v!.downloadUrl, "/api/descargas/tok123/videos/21");
  });
});
