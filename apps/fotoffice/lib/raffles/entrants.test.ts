import { describe, expect, it } from "vitest";
import { entrantsHash, orderEntrants } from "./entrants";

const socios = [
  { memberId: "m-3", memberNumber: "0117", fullName: "Ana Díaz" },
  { memberId: "m-1", memberNumber: "0012", fullName: "Beto Ruiz" },
  { memberId: "m-2", memberNumber: "0099", fullName: "Cielo Paz" },
];

describe("el orden del padrón", () => {
  it("ordena por número de socio y numera desde cero", () => {
    const orden = orderEntrants(socios);
    expect(orden.map((e) => e.memberNumber)).toEqual(["0012", "0099", "0117"]);
    expect(orden.map((e) => e.position)).toEqual([0, 1, 2]);
  });

  it("no depende del orden en que llegan las filas", () => {
    const a = orderEntrants(socios);
    const b = orderEntrants([...socios].reverse());
    expect(b).toEqual(a);
  });

  it("los números de socio se comparan como números, no como texto", () => {
    const orden = orderEntrants([
      { memberId: "m-b", memberNumber: "10", fullName: "B" },
      { memberId: "m-a", memberNumber: "9", fullName: "A" },
    ]);
    expect(orden.map((e) => e.memberNumber)).toEqual(["9", "10"]);
  });

  it("un número de socio no numérico va al final, y entre esos manda el texto", () => {
    const orden = orderEntrants([
      { memberId: "m-x", memberNumber: "H-2", fullName: "X" },
      { memberId: "m-a", memberNumber: "5", fullName: "A" },
      { memberId: "m-w", memberNumber: "H-1", fullName: "W" },
    ]);
    expect(orden.map((e) => e.memberNumber)).toEqual(["5", "H-1", "H-2"]);
  });

  it("empate imposible: dos socios nunca comparten número, pero si pasara manda el id", () => {
    const orden = orderEntrants([
      { memberId: "m-z", memberNumber: "7", fullName: "Z" },
      { memberId: "m-a", memberNumber: "7", fullName: "A" },
    ]);
    expect(orden.map((e) => e.memberId)).toEqual(["m-a", "m-z"]);
  });
});

describe("la huella del padrón", () => {
  it("es un SHA-256 en hexadecimal minúscula", () => {
    const h = entrantsHash("r-1", orderEntrants(socios));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el mismo padrón da la misma huella siempre", () => {
    expect(entrantsHash("r-1", orderEntrants(socios))).toBe(
      entrantsHash("r-1", orderEntrants([...socios].reverse())),
    );
  });

  it("cambia si cambia un socio", () => {
    const otro = [...socios.slice(1), { memberId: "m-9", memberNumber: "0300", fullName: "Otro" }];
    expect(entrantsHash("r-1", orderEntrants(otro))).not.toBe(
      entrantsHash("r-1", orderEntrants(socios)),
    );
  });

  it("se puede recalcular con lo que se publica: número de socio y posición, sin datos internos", () => {
    // Es la mitad de la prueba que hace un tercero. Si dependiera del id interno, que no se
    // publica, nadie de afuera podría rehacerla.
    const publicado = socios.map((s) => ({ ...s, memberId: "no-lo-sabe-nadie" }));
    expect(entrantsHash("r-1", orderEntrants(publicado))).toBe(
      entrantsHash("r-1", orderEntrants(socios)),
    );
  });

  it("cambia si cambia el sorteo: la huella de un padrón no sirve para otro sorteo", () => {
    expect(entrantsHash("r-2", orderEntrants(socios))).not.toBe(
      entrantsHash("r-1", orderEntrants(socios)),
    );
  });

  it("no la mueve una corrección de nombre: la prueba no puede caerse por una tilde", () => {
    const conTilde = [{ memberId: "m-1", memberNumber: "0012", fullName: "Béto Ruiz" }];
    const sinTilde = [{ memberId: "m-1", memberNumber: "0012", fullName: "Beto Ruiz" }];
    expect(entrantsHash("r-1", orderEntrants(conTilde))).toBe(
      entrantsHash("r-1", orderEntrants(sinTilde)),
    );
  });
});
