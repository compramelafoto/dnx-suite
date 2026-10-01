import { describe, expect, test } from "vitest";
import { TAMANO_MAXIMO_DE_PARTE, repartirEnPartes } from "./partes";

const foto = (id: string, bytes: number) => ({ id, bytes });

describe("cómo se parte un paquete grande", () => {
  test("un evento chico entra en una sola parte", () => {
    const partes = repartirEnPartes([foto("a", 1_000), foto("b", 2_000)]);
    expect(partes).toHaveLength(1);
    expect(partes[0]!.map((f) => f.id)).toEqual(["a", "b"]);
  });

  test("cuando no entra, se abre otra parte", () => {
    const mitad = Math.floor(TAMANO_MAXIMO_DE_PARTE * 0.6);
    const partes = repartirEnPartes([foto("a", mitad), foto("b", mitad)]);
    expect(partes).toHaveLength(2);
  });

  test("ninguna foto se pierde ni se repite", () => {
    // El invariante que importa: el cliente pagó por todas. Si una queda afuera
    // de todas las partes, la pierde y nadie se entera hasta que la busca.
    const fotos = Array.from({ length: 500 }, (_, i) =>
      foto(`f${i}`, 1_000_000 + ((i * 7919) % 9_000_000)),
    );
    const partes = repartirEnPartes(fotos);
    const ids = partes.flat().map((f) => f.id);

    expect(ids).toHaveLength(fotos.length);
    expect(new Set(ids).size).toBe(fotos.length);
    expect(ids.sort()).toEqual(fotos.map((f) => f.id).sort());
  });

  test("el orden se respeta", () => {
    // Las fotos se numeran dentro del paquete. Si el orden cambiara entre una
    // generación y otra, la foto 007 de un cliente no sería la misma que ayer.
    const fotos = Array.from({ length: 50 }, (_, i) => foto(`f${i}`, 5_000_000));
    expect(repartirEnPartes(fotos).flat().map((f) => f.id)).toEqual(fotos.map((f) => f.id));
  });

  test("una foto sola más grande que el tope va igual, en su propia parte", () => {
    // Dejarla afuera sería no entregar algo que el cliente pagó. Es preferible
    // una parte más grande de lo previsto a una foto faltante.
    const gigante = foto("enorme", TAMANO_MAXIMO_DE_PARTE * 2);
    const partes = repartirEnPartes([foto("a", 1_000), gigante, foto("b", 1_000)]);

    expect(partes.flat().map((f) => f.id)).toEqual(["a", "enorme", "b"]);
    expect(partes.some((p) => p.length === 1 && p[0]!.id === "enorme")).toBe(true);
  });

  test("sin fotos no hay partes", () => {
    expect(repartirEnPartes([])).toEqual([]);
  });

  test("una foto sin tamaño conocido no rompe el reparto", () => {
    // `originalBytes` puede ser nulo si la confirmación falló a mitad. Se le
    // asume un tamaño típico en vez de tratarla como si pesara cero.
    const partes = repartirEnPartes([{ id: "a", bytes: null }, foto("b", 1_000)]);
    expect(partes.flat().map((f) => f.id)).toEqual(["a", "b"]);
  });
});
