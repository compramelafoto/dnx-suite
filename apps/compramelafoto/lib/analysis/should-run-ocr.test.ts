import { strict as assert } from "node:assert";
import { test } from "node:test";
import { shouldRunOcr } from "./should-run-ocr.ts";

test("por defecto, la lectura de texto sólo corre en álbumes deportivos", () => {
  assert.equal(shouldRunOcr({ albumType: "SPORTS", requested: null }), true);
  assert.equal(shouldRunOcr({ albumType: "WEDDING", requested: null }), false);
  assert.equal(shouldRunOcr({ albumType: "BIRTHDAY", requested: null }), false);
  assert.equal(shouldRunOcr({ albumType: "SCHOOL", requested: null }), false);
});

test("un álbum sin tipo cargado no lee texto", () => {
  // 856 de los 998 álbumes de producción están así al 2026-10-09, y son el 90% de las
  // fotos. Es justo donde se iba la mitad de la factura de Amazon.
  assert.equal(shouldRunOcr({ albumType: null, requested: null }), false);
});

test("lo pedido a mano manda sobre el tipo de álbum", () => {
  // Para reprocesar un álbum puntual: una carrera de autos cargada sin tipo, por ejemplo.
  assert.equal(shouldRunOcr({ albumType: null, requested: true }), true);
  assert.equal(shouldRunOcr({ albumType: "WEDDING", requested: true }), true);

  // Y para apagarlo incluso en un deportivo, si alguien está reprocesando sólo caras.
  assert.equal(shouldRunOcr({ albumType: "SPORTS", requested: false }), false);
});

test("regresión: el cron ya no fuerza la lectura en todo", () => {
  /*
    Hasta el 2026-10-09 el cron corría `/api/internal/analysis/run?ocr=1` cada 2 minutos.
    Ese `ocr=1` encendía la lectura de texto en TODAS las fotos de la plataforma, que es
    el equivalente a `requested: true` acá abajo. Sacarlo del cron es lo que hace que
    mande el tipo de álbum.
  */
  const comoCorriaElCron = { albumType: "WEDDING" as const, requested: true };
  const comoCorreAhora = { albumType: "WEDDING" as const, requested: null };

  assert.equal(shouldRunOcr(comoCorriaElCron), true);
  assert.equal(shouldRunOcr(comoCorreAhora), false);
});
