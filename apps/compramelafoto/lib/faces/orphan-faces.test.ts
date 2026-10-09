import { strict as assert } from "node:assert";
import { test } from "node:test";
import { orphanFaceIds, OrphanScanRefusal, guardOrphanScan } from "./orphan-faces.ts";

test("huérfana es la cara que está en Amazon y no en la base", () => {
  const enAmazon = ["a", "b", "c", "d"];
  const enLaBase = new Set(["a", "c"]);

  assert.deepEqual(orphanFaceIds(enAmazon, enLaBase), ["b", "d"]);
});

test("una cara que está en la base nunca se toca", () => {
  const enAmazon = ["viva1", "viva2"];
  const enLaBase = new Set(["viva1", "viva2"]);

  assert.deepEqual(orphanFaceIds(enAmazon, enLaBase), []);
});

test("las selfies de los clientes también cuentan como vivas", () => {
  /*
    Hay dos orígenes de caras en la misma colección: las de las fotos del fotógrafo
    (`FaceDetection.rekognitionFaceId`) y las selfies con las que el cliente se busca
    (`AlbumInterest.faceId`). Si el barrido mirara sólo las primeras, borraría todas las
    selfies vigentes y los clientes dejarían de encontrarse.
  */
  const enAmazon = ["foto1", "selfie1"];
  const enLaBase = new Set(["foto1", "selfie1"]);

  assert.deepEqual(orphanFaceIds(enAmazon, enLaBase), []);
});

test("se planta si la base no devolvió ninguna cara", () => {
  /*
    Si la consulta a la base falla o devuelve vacío por error, TODAS las caras de Amazon
    parecerían huérfanas y el barrido vaciaría la colección entera. Esto es irreversible:
    reindexar 182.765 fotos cuesta unos USD 183 y varios días.
  */
  assert.throws(
    () => guardOrphanScan({ facesInDb: 0, facesInCollection: 674580 }),
    OrphanScanRefusal
  );
});

test("se planta si la base tiene sospechosamente pocas caras", () => {
  // Menos del 10% de lo que hay en la colección huele a consulta incompleta.
  assert.throws(
    () => guardOrphanScan({ facesInDb: 100, facesInCollection: 674580 }),
    OrphanScanRefusal
  );
});

test("deja pasar una proporción razonable", () => {
  // Lo esperable: la base tiene casi todas, y sobran unas pocas huérfanas.
  assert.doesNotThrow(() => guardOrphanScan({ facesInDb: 674521, facesInCollection: 674580 }));
});

test("una colección vacía no es un error, no hay nada que hacer", () => {
  assert.doesNotThrow(() => guardOrphanScan({ facesInDb: 0, facesInCollection: 0 }));
});
