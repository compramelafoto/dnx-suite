import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "stream";
import archiver from "archiver";

import {
  FOTOS_POR_PARTE,
  accesoAOriginales,
  armarPartes,
  idsDeLaParte,
  leerNumeroDeParte,
  nombreDeFotoEnZip,
  nombreDelZip,
} from "./originales";
import { escribirOriginales } from "./stream-originales-zip";

describe("accesoAOriginales", () => {
  it("deja pasar solo al dueño del álbum", () => {
    assert.deepEqual(accesoAOriginales({ userId: 791 }, 791), { ok: true });
  });

  it("rechaza a otro usuario con 403", () => {
    const r = accesoAOriginales({ userId: 791 }, 62);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, 403);
  });

  it("rechaza sin usuario", () => {
    const r = accesoAOriginales({ userId: 791 }, null);
    assert.equal(!r.ok && r.status, 403);
  });

  it("álbum inexistente o borrado da 404", () => {
    assert.equal((accesoAOriginales(null, 791) as { status: number }).status, 404);
    assert.equal(
      (accesoAOriginales({ userId: 791, deletedAt: new Date() }, 791) as { status: number }).status,
      404,
    );
  });
});

describe("armarPartes", () => {
  it("786 fotos dan 8 partes, la última de 86", () => {
    const partes = armarPartes(786);
    assert.equal(partes.length, 8);
    assert.deepEqual(partes[0], { parte: 1, desde: 1, hasta: 100, cantidad: 100 });
    assert.deepEqual(partes[7], { parte: 8, desde: 701, hasta: 786, cantidad: 86 });
    assert.equal(
      partes.reduce((s, p) => s + p.cantidad, 0),
      786,
    );
  });

  it("álbum vacío no tiene partes; uno chico tiene una", () => {
    assert.deepEqual(armarPartes(0), []);
    assert.equal(armarPartes(FOTOS_POR_PARTE).length, 1);
    assert.equal(armarPartes(FOTOS_POR_PARTE + 1).length, 2);
  });

  it("idsDeLaParte reparte sin perder ni repetir", () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    const todas = [1, 2, 3].flatMap((n) => idsDeLaParte(ids, n));
    assert.deepEqual(todas, ids);
    assert.deepEqual(idsDeLaParte(ids, 3), ids.slice(200));
  });
});

describe("leerNumeroDeParte", () => {
  it("acepta 1..total y rechaza lo demás", () => {
    assert.equal(leerNumeroDeParte("1", 8), 1);
    assert.equal(leerNumeroDeParte("8", 8), 8);
    for (const v of [null, "", "0", "9", "-1", "1.5", "abc", "2abc"]) {
      assert.equal(leerNumeroDeParte(v, 8), null, `valor ${v}`);
    }
  });
});

describe("nombres", () => {
  it("numera las fotos y usa el nombre original si existe", () => {
    assert.equal(nombreDeFotoEnZip(7, { id: 360785 }), "0007-foto-360785.jpg");
    assert.equal(nombreDeFotoEnZip(12, { id: 1, originalFilename: "DSC_0042.JPG" }), "0012-DSC_0042.JPG");
    assert.equal(nombreDeFotoEnZip(3, { id: 1, originalFilename: "carpeta/sala 4/IMG 1" }), "0003-IMG 1.jpg");
  });

  it("el ZIP lleva el título sin acentos y la parte", () => {
    assert.equal(nombreDelZip("FOTOGRAFÍA ESCOLAR", 2, 8), "FOTOGRAFIA-ESCOLAR-originales-parte-2-de-8");
    assert.equal(nombreDelZip("Boda", 1, 1), "Boda-originales");
  });
});

describe("escribirOriginales", () => {
  async function armar(fotos: { id: number; nombre: string }[], leer: (id: number) => Promise<Buffer>) {
    const archive = archiver("zip", { store: true });
    const nombres: string[] = [];
    archive.on("entry", (e) => nombres.push(e.name));
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on("data", (c: Buffer) => chunks.push(c));
    archive.pipe(sink);
    const resultado = await escribirOriginales(archive, fotos, leer);
    await archive.finalize();
    return { resultado, nombres, bytes: Buffer.concat(chunks) };
  }

  it("mete cada foto en orden y anota las que faltan sin cortar", async () => {
    const { resultado, nombres, bytes } = await armar(
      [
        { id: 1, nombre: "0001-foto-1.jpg" },
        { id: 2, nombre: "0002-foto-2.jpg" },
        { id: 3, nombre: "0003-foto-3.jpg" },
      ],
      async (id) => {
        if (id === 2) throw new Error("no está en R2");
        return Buffer.from(`jpg-${id}`);
      },
    );
    assert.deepEqual(resultado, { agregadas: 2, faltantes: [2] });
    assert.deepEqual(nombres, ["0001-foto-1.jpg", "0003-foto-3.jpg", "FALTANTES.txt"]);
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
  });

  it("sin faltantes no agrega FALTANTES.txt", async () => {
    const { nombres } = await armar([{ id: 9, nombre: "0001-foto-9.jpg" }], async () => Buffer.from("x"));
    assert.deepEqual(nombres, ["0001-foto-9.jpg"]);
  });
});
