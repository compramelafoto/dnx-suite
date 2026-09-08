import { describe, expect, it } from "vitest";
import { blockingSpaceIds, compatibleSpaceIds, normalizePair, pairsForSpace } from "./conflicts";

const salon = "salon";
const estudio = "estudio";
const coworking = "coworking";
const todos = [salon, estudio, coworking];

/** Estudio y coworking conviven; el salón no convive con nadie. */
const compatibilidades = [normalizePair(estudio, coworking)];

describe("un par se guarda siempre igual", () => {
  it("el orden en que se escribe no cambia la fila", () => {
    expect(normalizePair("b", "a")).toEqual(normalizePair("a", "b"));
  });

  it("el menor va primero", () => {
    expect(normalizePair("b", "a")).toEqual({ spaceAId: "a", spaceBId: "b" });
  });
});

describe("qué espacios tapan a este", () => {
  it("el espacio se tapa a sí mismo", () => {
    expect(blockingSpaceIds(salon, todos, compatibilidades)).toContain(salon);
  });

  it("el salón tapa a todos porque no convive con nadie", () => {
    expect(blockingSpaceIds(salon, todos, compatibilidades).sort()).toEqual(
      [coworking, estudio, salon].sort(),
    );
  });

  it("el estudio no es tapado por el coworking, con el que sí convive", () => {
    const bloquean = blockingSpaceIds(estudio, todos, compatibilidades);
    expect(bloquean).toContain(salon);
    expect(bloquean).toContain(estudio);
    expect(bloquean).not.toContain(coworking);
  });

  it("un espacio nuevo bloquea a todos hasta que alguien diga lo contrario", () => {
    // Es EL defecto del módulo: el error posible pasa a ser "no me deja reservar",
    // que se nota, en lugar de "vendí dos veces el mismo salón", que se nota tarde.
    const nuevo = "laboratorio";
    const bloquean = blockingSpaceIds(nuevo, [...todos, nuevo], compatibilidades);
    expect(bloquean.sort()).toEqual([...todos, nuevo].sort());
  });

  it("sin ninguna compatibilidad declarada, todos se bloquean entre sí", () => {
    expect(blockingSpaceIds(estudio, todos, []).sort()).toEqual(todos.slice().sort());
  });
});

describe("con quiénes convive", () => {
  it("devuelve el otro lado del par, sin importar de qué lado esté", () => {
    expect(compatibleSpaceIds(estudio, compatibilidades)).toEqual([coworking]);
    expect(compatibleSpaceIds(coworking, compatibilidades)).toEqual([estudio]);
  });

  it("un espacio sin compatibilidades devuelve la lista vacía", () => {
    expect(compatibleSpaceIds(salon, compatibilidades)).toEqual([]);
  });
});

describe("guardar las compatibilidades de un espacio", () => {
  it("arma un par normalizado por cada espacio elegido", () => {
    expect(pairsForSpace(estudio, [coworking, salon])).toEqual([
      normalizePair(estudio, coworking),
      normalizePair(estudio, salon),
    ]);
  });

  it("un espacio no puede ser compatible consigo mismo", () => {
    expect(pairsForSpace(estudio, [estudio, coworking])).toEqual([
      normalizePair(estudio, coworking),
    ]);
  });

  it("elegir dos veces el mismo no duplica el par", () => {
    expect(pairsForSpace(estudio, [coworking, coworking])).toHaveLength(1);
  });
});
