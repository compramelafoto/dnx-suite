import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";
import test from "node:test";

import sharp from "sharp";

import {
  aleatorioConSemilla,
  armarCopy,
  hablaDeTres,
  mezclarPlantillas,
  PLANTILLAS_DE_COPY,
} from "./redes-copys";
import { altoParaRedes, fichaParaRedes, fotoParaRedes } from "./redes-ficha";
import {
  leerFiltro,
  nombreDeArchivo,
  nombreDeCarpeta,
  pasaElFiltro,
  separarPublicables,
  type ObraParaRedes,
} from "./redes-seleccion";
import { armarZip, crc32 } from "./redes-zip";

const podio = [
  { puesto: 1, nombre: "Leandro Bordon", instagram: "leotank.life" },
  { puesto: 2, nombre: "Elisabet Sánchez", instagram: "@elisabetsanchez25" },
  { puesto: 3, nombre: "Anabel Giacobbo", instagram: "anabelgiacobbo" },
  { puesto: 4, nombre: "Ela", instagram: "elaqt_75" },
  { puesto: 4, nombre: "Noci", instagram: "nocinemilno" },
];

test("hay al menos 50 copys y todos invitan a votar y nombran a los finalistas", () => {
  assert.ok(PLANTILLAS_DE_COPY.length >= 50);
  for (const p of PLANTILLAS_DE_COPY) {
    assert.match(p, /\{CONSIGNA\}/);
    assert.match(p, /\{FINALISTAS\}|\{PODIO\}/);
    assert.match(p, /\{MENCION\}/);
    assert.match(p, /vot/i);
  }
  assert.equal(new Set(PLANTILLAS_DE_COPY).size, PLANTILLAS_DE_COPY.length);
});

test("el copy nombra a los finalistas en orden y saluda al 4.º puesto", () => {
  const copy = armarCopy({ consigna: "Movimiento", personas: [...podio].reverse(), plantilla: 0, azar: () => 0 });
  assert.match(copy, /MOVIMIENTO/);
  assert.match(copy, /@leotank\.life, @elisabetsanchez25 y @anabelgiacobbo/);
  assert.match(copy, /@elaqt_75 y @nocinemilno por su 4\.º puesto/);
  assert.doesNotMatch(copy, /\{|\}/);
});

test("sin menciones la línea desaparece y no queda un hueco doble", () => {
  for (let i = 0; i < PLANTILLAS_DE_COPY.length; i++) {
    const copy = armarCopy({ consigna: "Luz", personas: podio.slice(0, 3), plantilla: i, azar: () => 0 });
    assert.doesNotMatch(copy, /\{|\}/);
    assert.doesNotMatch(copy, /\n\n\n/);
  }
});

test("con menos de tres nombrados no se usa una plantilla que hable de tres", () => {
  const conTres = PLANTILLAS_DE_COPY.findIndex(hablaDeTres);
  const copy = armarCopy({ consigna: "Luz", personas: podio.slice(0, 2), plantilla: conTres, azar: () => 0 });
  assert.doesNotMatch(copy, /\btres\b/i);
});

test("sin Instagram, el copy usa el nombre", () => {
  const copy = armarCopy({
    consigna: "Luz",
    personas: [{ puesto: 1, nombre: "Ana Pérez", instagram: null }],
    plantilla: 0,
    azar: () => 0,
  });
  assert.match(copy, /Ana Pérez/);
});

test("las plantillas mezcladas no se repiten", () => {
  const orden = mezclarPlantillas(aleatorioConSemilla(42));
  assert.equal(new Set(orden).size, PLANTILLAS_DE_COPY.length);
});

test("el filtro lee varias consignas y ordena el rango", () => {
  const f = leerFiltro({ consigna: ["a", "b"], desde: "3", hasta: "1" });
  assert.deepEqual(f, { consignas: ["a", "b"], desde: 1, hasta: 3 });
  assert.deepEqual(leerFiltro({}), { consignas: [], desde: null, hasta: null });
});

test("el filtro respeta consigna, rango y empates; sin puesto queda afuera si hay rango", () => {
  const f = leerFiltro({ consigna: "a", desde: "1", hasta: "4" });
  assert.equal(pasaElFiltro({ promptExternalId: "a", puesto: 4 }, f), true);
  assert.equal(pasaElFiltro({ promptExternalId: "a", puesto: 5 }, f), false);
  assert.equal(pasaElFiltro({ promptExternalId: "b", puesto: 1 }, f), false);
  assert.equal(pasaElFiltro({ promptExternalId: "a", puesto: null }, f), false);
  assert.equal(pasaElFiltro({ promptExternalId: "a", puesto: null }, leerFiltro({})), true);
});

function obra(parcial: Partial<ObraParaRedes>): ObraParaRedes {
  return {
    snapshotId: "s",
    submissionId: "sub",
    consignaId: "a",
    puesto: 1,
    nota: 8,
    anonymousCode: "X-1",
    nombre: "Ana",
    numero: null,
    instagram: null,
    autorizaRedes: true,
    ...parcial,
  };
}

test("quien no autorizó redes, o no tiene foto, queda afuera", () => {
  const r = separarPublicables([
    obra({ snapshotId: "1", puesto: 2 }),
    obra({ snapshotId: "2", puesto: 1, autorizaRedes: false }),
    obra({ snapshotId: "3", puesto: 3, submissionId: null }),
    obra({ snapshotId: "4", puesto: 1 }),
  ]);
  assert.deepEqual(r.publicables.map((o) => o.snapshotId), ["4", "1"]);
  assert.deepEqual(r.sinPermiso.map((o) => o.snapshotId), ["2"]);
  assert.deepEqual(r.sinFoto.map((o) => o.snapshotId), ["3"]);
});

test("nombres de carpeta y archivo como los pidió la organización", () => {
  assert.equal(nombreDeCarpeta({ sequence: 3, titulo: "Movimiento" }), "Consigna 3 - Movimiento");
  assert.equal(
    nombreDeArchivo({ consigna: "Movimiento", puesto: 1, nombre: "Leandro Bordon", instagram: "leotank.life", tipo: "foto", cifras: 1 }),
    "Movimiento - 1 - Leandro Bordon - @leotank.life - a foto.jpg",
  );
  assert.equal(
    nombreDeArchivo({ consigna: "Luz/Sombra", puesto: 2, nombre: "Ana", instagram: null, tipo: "ficha", cifras: 2 }),
    "Luz Sombra - 02 - Ana - sin instagram - b ficha.jpg",
  );
});

test("el ZIP es válido para unzip, con tildes en los nombres", () => {
  const datos = new TextEncoder().encode("hola");
  assert.equal(crc32(datos), zlib.crc32(datos));
  const zip = armarZip([
    { nombre: "Consigna 1 - Acción/copy.txt", datos },
    { nombre: "Consigna 1 - Acción/foto.jpg", datos: new Uint8Array([1, 2, 3]) },
  ]);
  const dir = mkdtempSync(join(tmpdir(), "zip-redes-"));
  const ruta = join(dir, "x.zip");
  writeFileSync(ruta, zip);
  const salida = execFileSync("unzip", ["-t", ruta], { encoding: "utf8" });
  assert.match(salida, /No errors detected/);
});

test("la foto respeta las proporciones de Instagram y la ficha tiene su mismo tamaño", async () => {
  assert.equal(altoParaRedes(3000, 2000), 720);
  assert.equal(altoParaRedes(1000, 3000), 1350); // muy vertical: se completa a 4:5
  assert.equal(altoParaRedes(4000, 1000), 565); // panorámica: tope 1,91:1

  const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#3a6ea5" } })
    .jpeg()
    .toBuffer();
  const foto = await fotoParaRedes(original);
  const ficha = await fichaParaRedes(foto, {
    consigna: "Movimiento",
    puesto: 1,
    nombre: "Leandro Bordon",
    numero: "CKA26-00024",
    instagram: "leotank.life",
    codigo: "GENERA-0152",
    nota: 7.67,
    escala: 10,
  });
  const meta = await sharp(ficha.jpeg).metadata();
  assert.equal(meta.width, foto.ancho);
  assert.equal(meta.height, foto.alto);
});

test("la ficha dibuja el texto sin depender de las fuentes del sistema", async () => {
  const foto = await fotoParaRedes(
    await sharp({ create: { width: 800, height: 800, channels: 3, background: "#000" } }).jpeg().toBuffer(),
  );
  const ficha = await fichaParaRedes(foto, {
    consigna: "Luz",
    puesto: 2,
    nombre: "Ana",
    numero: null,
    instagram: null,
    codigo: "LUZ-0001",
    nota: 8,
    escala: 10,
  });
  // Las letras van en trazos: el SVG no tiene ningún <text> que pida una fuente.
  const { data, info } = await sharp(ficha.jpeg).raw().toBuffer({ resolveWithObject: true });
  let claros = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i]! > 200 && data[i + 1]! > 200 && data[i + 2]! > 200) claros++;
  }
  assert.ok(claros > 1500, `se esperaban letras blancas y hubo ${claros} píxeles claros`);
});
