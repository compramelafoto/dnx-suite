import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import {
  assertInstagramHandle,
  buildProfilePhotoDerivatives,
  CLICKATON_WELCOME_STORY_V1,
  collectMissingVariables,
  interpolateTemplate,
  normalizeInstagramHandle,
  RENDERER_VERSION,
  renderComposition,
  resolveCropParams,
  validateProfilePhotoBuffer,
} from "./index";

async function solidJpeg(w: number, h: number, color = { r: 200, g: 80, b: 40 }): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

test("instagram normalization", () => {
  assert.equal(normalizeInstagramHandle("@Ana_Foto")?.normalized, "ana_foto");
  assert.equal(normalizeInstagramHandle(" https://instagram.com/Ana.Foto/ ")?.handle, "ana.foto");
  assert.equal(normalizeInstagramHandle("bad handle!!"), null);
  assert.equal(assertInstagramHandle("clickaton_ar").url, "https://instagram.com/clickaton_ar");
});

test("variables interpolate", () => {
  assert.equal(interpolateTemplate("Hola {{participantName}}", { participantName: "Ana" }), "Hola Ana");
  assert.deepEqual(collectMissingVariables(["a", "b"], { a: "1" }), ["b"]);
});

test("photo validation + derivatives", async () => {
  const ok = await solidJpeg(640, 640);
  const meta = await validateProfilePhotoBuffer(ok, "image/jpeg");
  assert.ok(meta.width >= 400);
  const d = await buildProfilePhotoDerivatives(ok);
  assert.ok(d.thumbnail.byteLength > 0);
  assert.ok(d.square.byteLength > 0);
  assert.ok(d.storyCrop.byteLength > 0);
  assert.ok(["CENTER", "ATTENTION", "FACE", "MANUAL"].includes(d.crop.strategy));

  const tiny = await solidJpeg(100, 100);
  await assert.rejects(() => validateProfilePhotoBuffer(tiny, "image/jpeg"), /PHOTO_TOO_SMALL/);
});

test("crop without face falls back", async () => {
  const img = await solidJpeg(800, 600);
  const crop = await resolveCropParams(img);
  assert.ok(crop.boundingBox);
  assert.ok(crop.strategy === "CENTER" || crop.strategy === "ATTENTION");
});

test("render welcome story png+webp", async () => {
  const photo = await solidJpeg(900, 900);
  const logo = await sharp({
    create: { width: 400, height: 120, channels: 4, background: { r: 245, g: 197, b: 24, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const out = await renderComposition({
    template: CLICKATON_WELCOME_STORY_V1,
    variables: {
      participantName: "Ana Pérez",
      instagram: "ana_foto",
      participantNumber: "CKA26-00001",
      city: "Córdoba",
      province: "Córdoba",
      editionName: "Clickatón Argentina 2026",
      editionDate: "19/09/2026",
    },
    assets: { photo, logo },
  });

  assert.equal(out.width, 1080);
  assert.equal(out.height, 1920);
  assert.equal(out.templateId, "clickaton.welcome.story");
  assert.equal(out.rendererVersion, RENDERER_VERSION);
  assert.equal(out.contentHash.length, 64);
  assert.ok(out.png.byteLength > 1000);
  assert.ok(out.webp.byteLength > 500);
  const pngMeta = await sharp(out.png).metadata();
  assert.equal(pngMeta.format, "png");
  const webpMeta = await sharp(out.webp).metadata();
  assert.equal(webpMeta.format, "webp");

  // idempotencia de contenido con mismos inputs
  const out2 = await renderComposition({
    template: CLICKATON_WELCOME_STORY_V1,
    variables: {
      participantName: "Ana Pérez",
      instagram: "ana_foto",
      participantNumber: "CKA26-00001",
      city: "Córdoba",
      province: "Córdoba",
      editionName: "Clickatón Argentina 2026",
      editionDate: "19/09/2026",
    },
    assets: { photo, logo },
  });
  assert.equal(out.contentHash, out2.contentHash);
  assert.equal(
    createHash("sha256").update(out.png).digest("hex"),
    createHash("sha256").update(out2.png).digest("hex"),
  );
});

test("large and small images", async () => {
  const large = await solidJpeg(4000, 3000);
  await validateProfilePhotoBuffer(large, "image/jpeg");
  const d = await buildProfilePhotoDerivatives(large);
  assert.ok(d.square.byteLength > 0);

  const smallOk = await solidJpeg(420, 420);
  await validateProfilePhotoBuffer(smallOk, "image/jpeg");
});
