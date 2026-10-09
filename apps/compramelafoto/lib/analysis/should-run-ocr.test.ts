import { strict as assert } from "node:assert";
import { test } from "node:test";
import { shouldRunOcr } from "./should-run-ocr.ts";

test("el interruptor del álbum manda sobre todo lo demás", () => {
  // Encendido a mano en un casamiento: alguien sabrá por qué. Se respeta.
  assert.equal(
    shouldRunOcr({ textSearchEnabled: true, albumType: "WEDDING", requested: null }),
    true
  );
  // Apagado a mano en un deportivo: también se respeta.
  assert.equal(
    shouldRunOcr({ textSearchEnabled: false, albumType: "SPORTS", requested: null }),
    false
  );
});

test("sin interruptor decide el tipo de álbum", () => {
  // `null` es "no lo configuré": caen acá los 998 álbumes anteriores al interruptor.
  assert.equal(
    shouldRunOcr({ textSearchEnabled: null, albumType: "SPORTS", requested: null }),
    true
  );
  assert.equal(
    shouldRunOcr({ textSearchEnabled: null, albumType: "WEDDING", requested: null }),
    false
  );
});

test("un álbum sin interruptor y sin tipo no lee texto", () => {
  /*
    El caso más común de lejos: en septiembre se crearon 156 álbumes y sólo 11 tenían
    tipo. Acá es donde se iba la mitad de la factura de Amazon.
  */
  assert.equal(
    shouldRunOcr({ textSearchEnabled: null, albumType: null, requested: null }),
    false
  );
});

test("lo pedido a mano gana incluso sobre el interruptor", () => {
  /*
    `?ocr=1` es la herramienta del operador: reprocesar un álbum puntual sin tener que
    tocarle la configuración al fotógrafo ni dejarla cambiada después.
  */
  assert.equal(
    shouldRunOcr({ textSearchEnabled: false, albumType: "WEDDING", requested: true }),
    true
  );
  assert.equal(
    shouldRunOcr({ textSearchEnabled: true, albumType: "SPORTS", requested: false }),
    false
  );
});

test("regresión: el cron ya no fuerza la lectura en todo", () => {
  /*
    Hasta el 2026-10-09 el cron corría `/api/internal/analysis/run?ocr=1` cada 2 minutos.
    Ese `ocr=1` encendía la lectura en TODAS las fotos de la plataforma, que es el
    equivalente a `requested: true`. Sacarlo del cron es lo que hace que manden el
    interruptor y el tipo.
  */
  const album = { textSearchEnabled: null, albumType: "WEDDING" as const };

  assert.equal(shouldRunOcr({ ...album, requested: true }), true);
  assert.equal(shouldRunOcr({ ...album, requested: null }), false);
});
