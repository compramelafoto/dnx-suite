import { describe, expect, it } from "vitest";
import { elegirLugar } from "./elegir-lugar";

const rio = { latitude: -27.42, longitude: -56.6, city: null, raw: { class: "waterway" } };
const parana = { latitude: -31.73, longitude: -60.53, city: "Paraná", raw: { class: "boundary" } };

describe("elegirLugar", () => {
  it("salta el río y se queda con la ciudad", () => expect(elegirLugar([rio, parana])).toBe(parana));
  it("salta lo que cae fuera de la zona", () => {
    expect(elegirLugar([{ latitude: 40.4, longitude: -3.7, city: "Madrid", raw: { class: "place" } }, parana])).toBe(parana);
  });
  it("acepta una ciudad de otro país con muestras", () => {
    const montevideo = { latitude: -34.9011, longitude: -56.1645, city: "Montevideo", raw: { class: "boundary" } };
    expect(elegirLugar([montevideo])).toBe(montevideo);
  });
  it("sin resultados útiles → null", () => {
    expect(elegirLugar([rio])).toBeNull();
    expect(elegirLugar([])).toBeNull();
  });
  it("un resultado sin clase conocida sirve", () => expect(elegirLugar([{ latitude: -32.9, longitude: -60.6, city: null }])).not.toBeNull());
});
