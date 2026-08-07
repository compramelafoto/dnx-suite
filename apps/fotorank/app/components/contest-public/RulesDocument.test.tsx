import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RulesDocument } from "./RulesDocument";

const md = `# Título

## 8. Cronograma

Texto de apertura el **1 de agosto**.

- Ítem uno
- Ítem dos
`;

const html = renderToStaticMarkup(createElement(RulesDocument, { content: md }));

assert.ok(!html.includes("## 8"), "no debe mostrar marcadores markdown crudos");
assert.ok(html.includes("Cronograma"), "debe renderizar el título de sección");
assert.ok(html.includes("<strong>"), "debe parsear negrita");
assert.ok(html.includes("<ul"), "debe parsear listas");
assert.ok(!html.includes("# Título"), "skipLeadingH1 evita duplicar el H1");

console.log("RulesDocument.test: OK");
