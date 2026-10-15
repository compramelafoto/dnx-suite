import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoAssignClientPhotos,
  clientPhotoInputs,
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

test("la foto individual y la grupal van primero, con su nombre", () => {
  const bloque = (id: string, key: string) => ({
    id,
    type: "IMAGE",
    pageIndex: 0,
    configJson: { source: { variableKey: key } },
    layout: { width: 100, height: 100 },
  });
  const slots = listClientPhotoSlots([bloque("c", "photo_1"), bloque("g", "photo_group"), bloque("i", "photo_individual")]);
  assert.deepEqual(
    slots.map((s) => [s.blockId, s.label, s.role]),
    [
      ["i", "Foto individual", "individual"],
      ["g", "Foto grupal", "group"],
      ["c", "Foto 1", null],
    ],
  );
  const asignado = autoAssignClientPhotos(slots, [10, 20, 30]);
  assert.equal(asignado.i!.photoId, 10);
  assert.equal(asignado.g!.photoId, 20);
  assert.equal(asignado.c!.photoId, 30);
  assert.deepEqual(clientPhotoInputs(slots).map((x) => x.label), ["Foto individual", "Foto grupal", "Foto 1"]);
});

test("huecos con nombre: maestra, amigos y libre van después de individual y grupal, con su etiqueta y su rol", () => {
  const slots = listClientPhotoSlots(
    [
      img("libre", "photo_extra", 0),
      img("amigos", "photo_friends", 1),
      img("maestra", "photo_teacher", 1),
      img("grupal", "photo_group", 1),
      img("individual", "photo_individual", 0),
      img("numerada", "photo_1", 1),
    ],
    { photoInputs: [{ slotKey: "photo_friends", label: "Con mis amigos" }] },
  );
  assert.deepEqual(
    slots.map((s) => [s.blockId, s.label, s.role]),
    [
      ["individual", "Foto individual", "individual"],
      ["grupal", "Foto grupal", "group"],
      ["maestra", "Foto con la maestra", "teacher"],
      ["amigos", "Con mis amigos", "friends"],
      ["libre", "Foto libre", "extra"],
      ["numerada", "Foto 1", null],
    ],
  );
  assert.deepEqual(
    clientPhotoInputs(slots).map((i) => i.role),
    ["individual", "group", "teacher", "friends", "extra", null],
  );
});

test("una plantilla sin individual ni grupal (maestra + amigos) pide dos fotos y las arma en ese orden", () => {
  const slots = listClientPhotoSlots([
    img("amigos-tapa", "photo_friends", 0),
    img("maestra", "photo_teacher", 1),
    img("amigos-int", "photo_friends", 1),
  ]);
  assert.equal(countClientPhotoInputs(slots), 2);
  assert.deepEqual(clientPhotoInputs(slots).map((i) => i.label), ["Foto con la maestra", "Foto con amigos"]);
  const a = autoAssignClientPhotos(slots, [7, 8]);
  assert.equal(a.maestra!.photoId, 7);
  assert.equal(a["amigos-tapa"]!.photoId, 8);
  assert.equal(a["amigos-int"]!.photoId, 8);
});

test("cuatro fotos: individual, grupal, amigos y libre reciben una foto distinta cada una", () => {
  const slots = listClientPhotoSlots([
    img("e", "photo_extra"),
    img("f", "photo_friends"),
    img("g", "photo_group"),
    img("i", "photo_individual"),
  ]);
  const a = autoAssignClientPhotos(slots, [1, 2, 3, 4]);
  assert.deepEqual([a.i!.photoId, a.g!.photoId, a.f!.photoId, a.e!.photoId], [1, 2, 3, 4]);
  assert.ok(clientPhotoSlotNumber(img("t", "photo_teacher"))! < 0);
});
