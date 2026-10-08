import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoAssignClientPhotos,
  clientPhotoSlotNumber,
  computeCoverCropRect,
  countClientPhotoInputs,
  listClientPhotoSlots,
  normalizePhotoCrop,
} from "../client-photo-slots";

const img = (id: string, key: string | null, pageIndex = 0, extra: Record<string, unknown> = {}) => ({
  id,
  type: "IMAGE",
  pageIndex,
  width: 300,
  height: 200,
  configJson: key ? { src: "", source: { variableKey: key }, ...extra } : { src: "x.png" },
});

test("reconoce photo_n en source.variableKey y en la raíz, e ignora el resto", () => {
  assert.equal(clientPhotoSlotNumber(img("a", "photo_2")), 2);
  assert.equal(clientPhotoSlotNumber({ type: "PHOTO", configJson: { variableKey: "photo_10" } }), 10);
  assert.equal(clientPhotoSlotNumber(img("b", "branding.schoolLogoUrl")), null);
  assert.equal(clientPhotoSlotNumber(img("c", null)), null);
  assert.equal(clientPhotoSlotNumber({ type: "TEXT", configJson: { variableKey: "photo_1" } }), null);
});

test("lista los huecos en orden y toma la etiqueta de photoInputs", () => {
  const slots = listClientPhotoSlots(
    [img("tres", "photo_3", 1), img("logo", "branding.schoolLogoUrl"), img("uno", "photo_1")],
    { photoInputs: [{ slotKey: "photo_3", label: "Foto grupal" }] },
  );
  assert.deepEqual(
    slots.map((s) => [s.blockId, s.slotNumber, s.label]),
    [
      ["uno", 1, "Foto 1"],
      ["tres", 3, "Foto grupal"],
    ],
  );
});

test("el armado automático reparte en orden, comparte la foto entre huecos de igual número y deja vacíos los que faltan", () => {
  const slots = listClientPhotoSlots([
    img("frente", "photo_1", 0),
    img("dorso", "photo_1", 1),
    img("dos", "photo_2"),
    img("cinco", "photo_5"),
  ]);
  assert.equal(countClientPhotoInputs(slots), 3);
  const a = autoAssignClientPhotos(slots, [11, 22]);
  assert.equal(a.frente!.photoId, 11);
  assert.equal(a.dorso!.photoId, 11);
  assert.equal(a.dos!.photoId, 22);
  assert.equal(a.cinco!.photoId, null);
  assert.deepEqual(a.frente!.crop, { zoom: 1, x: 0, y: 0 });
});

test("normaliza el recorte", () => {
  assert.deepEqual(normalizePhotoCrop({ zoom: 9, x: -3, y: "a" }), { zoom: 4, x: -1, y: 0 });
  assert.deepEqual(normalizePhotoCrop(null), { zoom: 1, x: 0, y: 0 });
});

test("recorte cubriendo: foto apaisada en hueco cuadrado toma el centro", () => {
  const r = computeCoverCropRect({ srcWidth: 4000, srcHeight: 2000, slotWidth: 100, slotHeight: 100 });
  assert.deepEqual(r, { left: 1000, top: 0, width: 2000, height: 2000 });
});

test("recorte con desplazamiento y zoom queda dentro de la foto", () => {
  const izquierda = computeCoverCropRect({
    srcWidth: 4000,
    srcHeight: 2000,
    slotWidth: 1,
    slotHeight: 1,
    crop: { zoom: 1, x: -1, y: 0 },
  });
  assert.equal(izquierda.left, 0);
  const zoom = computeCoverCropRect({
    srcWidth: 4000,
    srcHeight: 2000,
    slotWidth: 1,
    slotHeight: 1,
    crop: { zoom: 2, x: 1, y: 1 },
  });
  assert.deepEqual(zoom, { left: 3000, top: 1000, width: 1000, height: 1000 });
});
