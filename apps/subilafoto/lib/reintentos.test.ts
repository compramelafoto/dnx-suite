import { describe, expect, test } from "vitest";
import { ErrorDefinitivo, conReintentos, esDefinitivo } from "./reintentos";

/** Reemplaza la espera para que el test no tarde de verdad. */
const sinEsperar = { esperar: async () => {} };

describe("reintentar", () => {
  test("si sale bien la primera, no reintenta", async () => {
    let veces = 0;
    const r = await conReintentos(async () => {
      veces++;
      return "listo";
    }, sinEsperar);

    expect(r).toBe("listo");
    expect(veces).toBe(1);
  });

  test("dos caídas y a la tercera sale", async () => {
    let veces = 0;
    const r = await conReintentos(async () => {
      veces++;
      if (veces < 3) throw new Error("se cortó");
      return "listo";
    }, sinEsperar);

    expect(r).toBe("listo");
    expect(veces).toBe(3);
  });

  test("después de tres intentos se rinde y deja pasar el último error", async () => {
    let veces = 0;
    await expect(
      conReintentos(async () => {
        veces++;
        throw new Error(`intento ${veces}`);
      }, sinEsperar),
    ).rejects.toThrow("intento 3");
    expect(veces).toBe(3);
  });

  test("un error definitivo NO se reintenta", async () => {
    // "El evento ya terminó" no mejora esperando: reintentarlo son 2,4 segundos de
    // demora para mostrar el mismo mensaje.
    let veces = 0;
    await expect(
      conReintentos(async () => {
        veces++;
        throw new ErrorDefinitivo("El evento ya terminó.");
      }, sinEsperar),
    ).rejects.toThrow("El evento ya terminó.");
    expect(veces).toBe(1);
  });

  test("la espera crece entre intentos", async () => {
    const esperas: number[] = [];
    await conReintentos(
      async () => {
        if (esperas.length < 2) throw new Error("se cortó");
        return "listo";
      },
      { esperar: async (ms) => void esperas.push(ms) },
    );

    expect(esperas).toEqual([800, 1600]);
  });

  test("no espera después del último intento", async () => {
    const esperas: number[] = [];
    await expect(
      conReintentos(
        async () => {
          throw new Error("siempre mal");
        },
        { esperar: async (ms) => void esperas.push(ms) },
      ),
    ).rejects.toThrow();
    // Tres intentos, dos esperas: esperar después del último es demorar el error.
    expect(esperas).toHaveLength(2);
  });
});

describe("qué respuesta no vale la pena reintentar", () => {
  test("los errores del que pide son definitivos", () => {
    expect(esDefinitivo(400)).toBe(true);
    expect(esDefinitivo(403)).toBe(true);
    expect(esDefinitivo(409)).toBe(true);
    expect(esDefinitivo(429)).toBe(true);
  });

  test("los del servidor no: puede andar en un rato", () => {
    expect(esDefinitivo(500)).toBe(false);
    expect(esDefinitivo(502)).toBe(false);
    expect(esDefinitivo(503)).toBe(false);
  });

  test("el 408 es la excepción: es la conexión, no el pedido", () => {
    expect(esDefinitivo(408)).toBe(false);
  });
});
