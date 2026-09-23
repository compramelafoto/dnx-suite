import test from "node:test";
import assert from "node:assert/strict";

import {
  configDelMetodo,
  CUPO_POR_OMISION,
  esMetodoValido,
  METODOS_DE_CALIFICACION,
  METODO_POR_OMISION,
  QUE_HACE_CADA_METODO,
} from "./metodos";

test("todos los métodos tienen explicación", () => {
  for (const m of METODOS_DE_CALIFICACION) {
    const texto = QUE_HACE_CADA_METODO[m.valor];
    assert.ok(texto && texto.length > 0, `${m.valor} sin explicación`);
  }
});

test("ninguna explicación nombra el código interno", () => {
  for (const m of METODOS_DE_CALIFICACION) {
    const texto = QUE_HACE_CADA_METODO[m.valor];
    assert.ok(!texto.includes("_"), `${m.valor} habla en jerga: ${texto}`);
  }
});

test("un método inventado se rechaza", () => {
  assert.equal(esMetodoValido("PUNTAJE_SECRETO"), false);
  assert.equal(esMetodoValido(""), false);
});

test("los métodos reales se aceptan", () => {
  for (const m of METODOS_DE_CALIFICACION) {
    assert.equal(esMetodoValido(m.valor), true);
  }
});

test("el método por omisión es uno de los válidos", () => {
  assert.equal(esMetodoValido(METODO_POR_OMISION), true);
});

test("sólo el cupo lleva configuración; el resto va vacío", () => {
  for (const m of METODOS_DE_CALIFICACION) {
    const config = configDelMetodo(m.valor, 5);
    if (m.valor === "SELECTION_WITH_QUOTA") {
      assert.deepEqual(config, { quota: 5 });
    } else {
      assert.deepEqual(config, {}, `${m.valor} no debería llevar configuración`);
    }
  }
});

test("un cupo inválido cae en el valor por omisión, no en cero", () => {
  for (const malo of [0, -3, null, NaN]) {
    assert.deepEqual(
      configDelMetodo("SELECTION_WITH_QUOTA", malo as number | null),
      { quota: CUPO_POR_OMISION },
      `cupo ${malo} debería caer en el valor por omisión`,
    );
  }
});

test("un cupo con decimales se redondea hacia abajo", () => {
  assert.deepEqual(configDelMetodo("SELECTION_WITH_QUOTA", 7.9), { quota: 7 });
});

test("los criterios múltiples no mandan lista propia", () => {
  // Si cada maratón mandara la suya, terminarían con criterios distintos sin
  // que nadie lo haya decidido. Se usa la que ya trae FotoRank.
  assert.deepEqual(configDelMetodo("CRITERIA_BASED", 5), {});
});
