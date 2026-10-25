import assert from "node:assert/strict";
import { test } from "node:test";
import { armarCompaneros, type FilaDelPadron } from "./companeros";

const fila = (id: number, nombre: string, apellido: string, foto?: Partial<FilaDelPadron>): FilaDelPadron => ({
  id,
  snapshotFirstName: nombre,
  snapshotLastName: apellido,
  mosaicPhotoId: null,
  mosaicPhotoAspect: null,
  mosaicPhotoCrop: null,
  urlDeVista: null,
  ...foto,
});

test("los compañeros no llevan al dueño de la carpeta", () => {
  const r = armarCompaneros([fila(1, "Ana", "Paz"), fila(2, "Juan", "Gómez"), fila(3, "Lía", "Ruiz")], 2);
  assert.deepEqual(r.map((c) => c.firstName), ["Ana", "Lía"]);
});

test("con retrato llevan la foto, la vista, el encuadre y la proporción", () => {
  const r = armarCompaneros(
    [fila(1, "Ana", "Paz", { mosaicPhotoId: 70, mosaicPhotoAspect: 0.75, mosaicPhotoCrop: { zoom: 1.4, x: 0, y: -0.3 }, urlDeVista: "https://r2/p.jpg" })],
    99,
  );
  assert.deepEqual(r[0], {
    firstName: "Ana",
    lastName: "Paz",
    photoId: 70,
    photoUrl: "https://r2/p.jpg",
    crop: { zoom: 1.4, x: 0, y: -0.3 },
    sourceAspect: 0.75,
  });
});

test("sin retrato va sólo el nombre (silueta), y un encuadre roto se ignora", () => {
  const r = armarCompaneros([fila(1, "Ana", "Paz"), fila(2, "Lía", "Ruiz", { mosaicPhotoId: 5, mosaicPhotoCrop: "roto" })], 99);
  assert.deepEqual(r[0], { firstName: "Ana", lastName: "Paz" });
  assert.deepEqual(r[1], { firstName: "Lía", lastName: "Ruiz", photoId: 5 });
});

test("los nombres se limpian de espacios", () => {
  assert.deepEqual(armarCompaneros([fila(1, "  Ana ", " Paz  ")], 99)[0], { firstName: "Ana", lastName: "Paz" });
});
