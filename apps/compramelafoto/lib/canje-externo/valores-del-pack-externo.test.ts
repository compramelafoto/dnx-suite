import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EXTERNAL_PREVENTA_KIND, type ExternalPreventaRefs } from "./external-preventa";
import { valoresDelPackExternoDesdePacks } from "./valores-del-pack-externo";

const pack = (studentName: string, courseName = "5.º A"): ExternalPreventaRefs => ({
  kind: EXTERNAL_PREVENTA_KIND,
  studentName,
  parentName: null,
  courseName,
  schoolName: "Colegio del Excel",
  label: null,
});

const LOGO = "https://pub-ejemplo.r2.dev/school-logos/33/logo.png";

describe("valoresDelPackExternoDesdePacks", () => {
  it("lleva el logo del colegio del álbum al librito", () => {
    const v = valoresDelPackExternoDesdePacks({
      externo: pack("Pérez Ana"),
      packsDelAlbum: [],
      schoolName: "Colegio Ntra. Sra. de Los Ángeles",
      schoolLogoUrl: LOGO,
      buyerName: null,
      photographerName: null,
    });
    assert.equal(v["branding.schoolLogoUrl"], LOGO);
    assert.equal(v["school.name"], "Colegio Ntra. Sra. de Los Ángeles");
  });

  it("sin logo cargado no manda la variable (el bloque del logo no se dibuja)", () => {
    const v = valoresDelPackExternoDesdePacks({
      externo: pack("Pérez Ana"),
      packsDelAlbum: [],
      schoolName: null,
      schoolLogoUrl: "  ",
      buyerName: null,
      photographerName: null,
    });
    assert.equal("branding.schoolLogoUrl" in v, false);
    assert.equal(v["school.name"], "Colegio del Excel");
  });

  it("arma el listado con los packs del mismo curso, sin repetidos y marcando al alumno", () => {
    const v = valoresDelPackExternoDesdePacks({
      externo: pack("Pérez Ana"),
      packsDelAlbum: [pack("Pérez Ana"), pack("Gómez Luis"), pack("gómez luis"), pack("Díaz Eva", "6.º B"), null],
      schoolName: null,
      schoolLogoUrl: null,
      buyerName: null,
      photographerName: null,
    });
    const listado = JSON.parse(v["course.studentList"]!) as {
      g: Array<{ t: string; k: string; s: Array<{ f: string; l: string; o?: number }> }>;
    };
    // Un curso, con su título: el listado siempre lleva el nombre del curso arriba.
    assert.equal(listado.g.length, 1);
    assert.equal(listado.g[0]!.t, "5.º A");
    assert.equal(listado.g[0]!.k, "excel|5.º A");
    const lista = listado.g[0]!.s;
    assert.equal(lista.length, 2);
    assert.equal(lista.filter((a) => a.o === 1).length, 1);
  });
  it("arma el mosaico con el padrón del curso, sin el dueño y con los retratos", () => {
    const fila = (id: number, nombre: string, apellido: string, foto?: number) => ({
      id,
      snapshotFirstName: nombre,
      snapshotLastName: apellido,
      mosaicPhotoId: foto ?? null,
      mosaicPhotoAspect: foto ? 0.8 : null,
      mosaicPhotoCrop: null,
      urlDeVista: foto ? `https://fotos.test/${foto}.jpg` : null,
    });
    const v = valoresDelPackExternoDesdePacks({
      externo: pack("Pérez Ana"),
      packsDelAlbum: [],
      schoolName: null,
      schoolLogoUrl: null,
      buyerName: null,
      photographerName: null,
      padronDelCurso: [fila(1, "Ana", "Pérez", 10), fila(2, "Luis", "Gómez", 11), fila(3, "Eva", "Díaz")],
    });
    const mosaico = JSON.parse(v["course.mosaic"]!) as unknown[];
    assert.equal(mosaico.length, 2);
    assert.match(v["course.mosaic"]!, /Gómez/);
    assert.doesNotMatch(v["course.mosaic"]!, /Pérez/);
    assert.match(v["course.mosaicOwner"]!, /Pérez/);
    // Sin otros packs, el listado sale del padrón.
    assert.match(v["course.studentList"]!, /Díaz/);
  });

  it("sin padrón, el mosaico lleva los compañeros de los packs sólo con su nombre", () => {
    const v = valoresDelPackExternoDesdePacks({
      externo: pack("Pérez Ana"),
      packsDelAlbum: [pack("Pérez Ana"), pack("Gómez Luis")],
      schoolName: null,
      schoolLogoUrl: null,
      buyerName: null,
      photographerName: null,
    });
    assert.match(v["course.mosaic"]!, /Gómez/);
    assert.doesNotMatch(v["course.mosaic"]!, /Pérez/);
  });
});
