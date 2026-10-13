import { describe, expect, test } from "vitest";
import { CADA_BANNER_MS, cualBannerToca } from "./banners-rotativos";

const recorrido = (vueltas: number, cuantosProveedores: number) =>
  Array.from({ length: vueltas }, (_, v) => cualBannerToca({ vuelta: v, cuantosProveedores }));

describe("a quién le toca el pie del teléfono", () => {
  test("sin proveedores no hay rotación", () => {
    // Un pie que "rota" entre una sola cosa parpadea sin motivo.
    expect(recorrido(5, 0).every((t) => t.tipo === "FOTOGRAFO")).toBe(true);
  });

  test("el fotógrafo no se diluye: uno de cada dos turnos", () => {
    /*
      Con seis proveedores, repartir en partes iguales lo dejaría con un séptimo de su
      propia pantalla, delante de su propio cliente. Es su pie, y los proveedores están
      ahí porque él los invitó.
    */
    const suyos = recorrido(20, 6).filter((t) => t.tipo === "FOTOGRAFO").length;

    expect(suyos).toBe(10);
  });

  test("los proveedores se reparten la otra mitad, sin saltearse ninguno", () => {
    const vistos = recorrido(12, 3)
      .flatMap((t) => (t.tipo === "PROVEEDOR" ? [t.indice] : []));

    expect(vistos).toEqual([0, 1, 2, 0, 1, 2]);
  });

  test("con un solo proveedor, alternan", () => {
    const tipos = recorrido(4, 1).map((t) => t.tipo);

    expect(tipos).toEqual(["FOTOGRAFO", "PROVEEDOR", "FOTOGRAFO", "PROVEEDOR"]);
  });

  test("el índice nunca se sale de la lista", () => {
    // Un proveedor que se da de baja deja la lista más corta de lo que la vuelta supone.
    for (const cuantos of [1, 2, 5]) {
      for (const vuelta of [0, 3, 77, 1000]) {
        const t = cualBannerToca({ vuelta, cuantosProveedores: cuantos });
        if (t.tipo === "PROVEEDOR") {
          expect(t.indice).toBeGreaterThanOrEqual(0);
          expect(t.indice).toBeLessThan(cuantos);
        }
      }
    }
  });

  test("cada banner se queda lo suficiente para registrarlo", () => {
    // Nadie mira el pie: lo ve de reojo mientras elige una foto.
    expect(CADA_BANNER_MS).toBeGreaterThanOrEqual(5_000);
  });
});
