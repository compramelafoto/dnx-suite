/*
  Con vitest y no con `node:test`.

  El resto de `lib/analysis` corre con `vitest.analysis.config.ts`, que recoge todos los
  archivos de prueba de la carpeta. Mezclar los dos runners hacía que vitest tomara éste, no
  encontrara ninguna prueba suya y diera el archivo por fallado — con las pruebas
  intactas y en verde por dentro, que es la peor forma de fallar.
*/
import { describe, expect, test } from "vitest";
import { shouldRunOcr } from "./should-run-ocr";

describe("cuándo vale la pena leer el texto de una foto", () => {
  test("el interruptor del álbum manda sobre todo lo demás", () => {
    // Encendido a mano en un casamiento: alguien sabrá por qué. Se respeta.
    expect(shouldRunOcr({ textSearchEnabled: true, albumType: "WEDDING", requested: null })).toBe(
      true,
    );
    // Apagado a mano en un deportivo: también se respeta.
    expect(shouldRunOcr({ textSearchEnabled: false, albumType: "SPORTS", requested: null })).toBe(
      false,
    );
  });

  test("sin interruptor decide el tipo de álbum", () => {
    // `null` es "no lo configuré": caen acá los 998 álbumes anteriores al interruptor.
    expect(shouldRunOcr({ textSearchEnabled: null, albumType: "SPORTS", requested: null })).toBe(
      true,
    );
    expect(shouldRunOcr({ textSearchEnabled: null, albumType: "WEDDING", requested: null })).toBe(
      false,
    );
  });

  test("un álbum sin interruptor y sin tipo no lee texto", () => {
    /*
      El caso más común de lejos: en septiembre se crearon 156 álbumes y sólo 11 tenían
      tipo. Acá es donde se iba la mitad de la factura de Amazon.
    */
    expect(shouldRunOcr({ textSearchEnabled: null, albumType: null, requested: null })).toBe(false);
  });

  test("lo pedido a mano gana incluso sobre el interruptor", () => {
    /*
      `?ocr=1` es la herramienta del operador: reprocesar un álbum puntual sin tener que
      tocarle la configuración al fotógrafo ni dejarla cambiada después.
    */
    expect(shouldRunOcr({ textSearchEnabled: false, albumType: "WEDDING", requested: true })).toBe(
      true,
    );
    expect(shouldRunOcr({ textSearchEnabled: true, albumType: "SPORTS", requested: false })).toBe(
      false,
    );
  });

  test("regresión: el cron ya no fuerza la lectura en todo", () => {
    /*
      Hasta el 2026-10-09 el cron corría `/api/internal/analysis/run?ocr=1` cada 2
      minutos. Ese `ocr=1` encendía la lectura en TODAS las fotos de la plataforma, que
      es el equivalente a `requested: true`. Sacarlo del cron es lo que hace que manden
      el interruptor y el tipo.
    */
    const album = { textSearchEnabled: null, albumType: "WEDDING" as const };

    expect(shouldRunOcr({ ...album, requested: true })).toBe(true);
    expect(shouldRunOcr({ ...album, requested: null })).toBe(false);
  });
});
