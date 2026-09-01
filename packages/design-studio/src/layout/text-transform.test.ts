import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDesignDocument } from "../document/parse";
import { buildLayoutPlan, type LayoutTextItem } from "./plan";
import type { TextMeasurer } from "./plan";

const medidor: TextMeasurer = { widthOf: (t, _f, _s, sizePt) => t.length * sizePt * 0.5 };

function dibujar(content: string, textTransform?: string): string {
  const doc = parseDesignDocument({
    schemaVersion: 1,
    metadata: { name: "p" },
    format: { medium: "PRINT", width: 200, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [{ id: "a", name: "A", background: "#ffffff", blocks: [{
      id: "t", type: "text", x: 5, y: 5, width: 180, height: 20,
      fontId: "dmSans", fontSize: 10, color: "#000000", content,
      ...(textTransform ? { textTransform } : {}),
    }] }],
  });
  if (!doc.ok) throw new Error(doc.errors.join(", "));
  const plan = buildLayoutPlan(doc.value, { values: { nombre: "maría fernanda gómez" }, omitted: [] }, { measurer: medidor });
  if (!plan.ok) throw new Error(plan.errors.join(", "));
  const item = plan.value.pages[0]!.items[0] as LayoutTextItem;
  return item.lines.join(" ");
}

test("sin conversión el texto queda como se escribió", () => {
  assert.equal(dibujar("Hola Mundo"), "Hola Mundo");
});

test("MAYÚSCULAS", () => {
  assert.equal(dibujar("Hola Mundo", "uppercase"), "HOLA MUNDO");
});

test("minúsculas", () => {
  assert.equal(dibujar("HOLA MUNDO", "lowercase"), "hola mundo");
});

test("Iniciales", () => {
  assert.equal(dibujar("hola mundo", "capitalize"), "Hola Mundo");
});

test("Iniciales también arregla un texto que venía todo en mayúsculas", () => {
  // Sin bajar primero, "GÓMEZ" quedaría igual y la conversión no serviría para el padrón.
  assert.equal(dibujar("JUAN GÓMEZ", "capitalize"), "Juan Gómez");
});

test("respeta los acentos y la eñe", () => {
  assert.equal(dibujar("josé peña", "uppercase"), "JOSÉ PEÑA");
  assert.equal(dibujar("MARÍA ÑANDÚ", "lowercase"), "maría ñandú");
});

test("se aplica al valor de la variable, no al marcador", () => {
  /*
   * Es lo que hace que sirva de verdad: el nombre llega del padrón en minúsculas y se imprime
   * en mayúsculas sin tocar el dato. Convertir el marcador daría {{NOMBRE}}, que no resuelve.
   */
  assert.equal(dibujar("{{nombre}}", "uppercase"), "MARÍA FERNANDA GÓMEZ");
  assert.equal(dibujar("{{nombre}}", "capitalize"), "María Fernanda Gómez");
});

test("una conversión inventada no rompe: no convierte", () => {
  assert.equal(dibujar("Hola", "gritando"), "Hola");
});
