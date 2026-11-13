import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describirCombinacion,
  mejorPrecioConPacks,
  preciosConPacksDelEvento,
  repartirProporcional,
  type PackDelEvento,
} from "./packs-evento";

/** Los packs de Ayelen en Hakai Games (precio suelto $4.000). */
const HAKAI: PackDelEvento[] = [
  { id: "p5", nombre: "Pack digital 5 fotos", fotos: 5, precio: 18000 },
  { id: "p10", nombre: "Pack digital 10 fotos", fotos: 10, precio: 34000 },
  { id: "p15", nombre: "Pack digital 15 fotos", fotos: 15, precio: 48000 },
];

describe("packs del evento: el precio más barato", () => {
  it("menos fotos que el pack más chico: todo suelto", () => {
    const c = mejorPrecioConPacks({ cantidad: 4, precioSuelto: 4000, packs: HAKAI });
    assert.equal(c.total, 16000);
    assert.equal(c.sueltas, 4);
    assert.deepEqual(c.packs, []);
  });

  it("5 fotos: el pack de 5", () => {
    const c = mejorPrecioConPacks({ cantidad: 5, precioSuelto: 4000, packs: HAKAI });
    assert.equal(c.total, 18000);
    assert.equal(describirCombinacion(c), "1 × Pack digital 5 fotos");
  });

  it("7 fotos: pack de 5 + 2 sueltas", () => {
    const c = mejorPrecioConPacks({ cantidad: 7, precioSuelto: 4000, packs: HAKAI });
    assert.equal(c.total, 26000);
    assert.equal(describirCombinacion(c), "1 × Pack digital 5 fotos + 2 fotos sueltas");
  });

  it("10 fotos: el de 10 (34.000) gana a dos de 5 (36.000)", () => {
    assert.equal(mejorPrecioConPacks({ cantidad: 10, precioSuelto: 4000, packs: HAKAI }).total, 34000);
  });

  it("20 fotos: el de 15 + el de 5 (66.000) gana a dos de 10 (68.000)", () => {
    const c = mejorPrecioConPacks({ cantidad: 20, precioSuelto: 4000, packs: HAKAI });
    assert.equal(c.total, 66000);
    assert.equal(c.sueltas, 0);
  });

  it("ignora packs inválidos y, con dos de la misma cantidad, usa el más barato", () => {
    const c = mejorPrecioConPacks({
      cantidad: 5,
      precioSuelto: 4000,
      packs: [
        { id: "a", nombre: "A", fotos: 5, precio: 19000 },
        { id: "b", nombre: "B", fotos: 5, precio: 17000 },
        { id: "c", nombre: "C", fotos: 0, precio: 1 },
        { id: "d", nombre: "D", fotos: 3, precio: 0 },
      ],
    });
    assert.equal(c.total, 17000);
    assert.equal(c.packs[0].id, "b");
  });
});

describe("packs del evento: reparto por cantidad de fotos", () => {
  it("el ejemplo acordado: pack de 5 con 3 de Ayelen y 2 de Martin = 10.800 / 7.200", () => {
    const r = preciosConPacksDelEvento({
      albumes: [
        { albumId: 1268, photoIds: [1, 2, 3] },
        { albumId: 1410, photoIds: [4, 5] },
      ],
      precioSuelto: 4000,
      packs: HAKAI,
    })!;
    assert.equal(r.basePorAlbum.get(1268), 10800);
    assert.equal(r.basePorAlbum.get(1410), 7200);
    assert.equal(r.basePorFoto.get(1), 3600);
    assert.equal(r.basePorFoto.get(5), 3600);
  });

  it("la suma por foto y por álbum da siempre el total exacto (con redondeo)", () => {
    for (let a = 1; a <= 20; a++) {
      for (let b = 0; b <= 20; b++) {
        const r = preciosConPacksDelEvento({
          albumes: [
            { albumId: 1, photoIds: Array.from({ length: a }, (_, i) => i + 1) },
            { albumId: 2, photoIds: Array.from({ length: b }, (_, i) => 100 + i) },
          ],
          precioSuelto: 4000,
          packs: HAKAI,
        });
        if (!r) {
          assert.ok(a + b < 5, `${a}+${b}: sólo sin pack si son menos de 5`);
          continue;
        }
        const porAlbum = [...r.basePorAlbum.values()].reduce((s, x) => s + x, 0);
        const porFoto = [...r.basePorFoto.values()].reduce((s, x) => s + x, 0);
        assert.equal(porAlbum, r.combinacion.total);
        assert.equal(porFoto, r.combinacion.total);
        assert.equal(r.basePorFoto.size, a + b);
      }
    }
  });

  it("sin packs o sin mejora no toca nada", () => {
    const albumes = [{ albumId: 1, photoIds: [1, 2, 3, 4, 5] }];
    assert.equal(preciosConPacksDelEvento({ albumes, precioSuelto: 4000, packs: [] }), null);
    assert.equal(
      preciosConPacksDelEvento({ albumes, precioSuelto: 4000, packs: [{ id: "x", nombre: "X", fotos: 5, precio: 25000 }] }),
      null,
    );
  });

  it("resto mayor: 10 pesos en 3 partes iguales da 4/3/3", () => {
    const r = repartirProporcional(10, [
      { clave: "a", peso: 1 },
      { clave: "b", peso: 1 },
      { clave: "c", peso: 1 },
    ]);
    assert.deepEqual([...r.values()], [4, 3, 3]);
  });
});
