import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/**
 * El preview inyecta HTML generado a partir de datos que escribe un administrador. El
 * escapado del renderer es la primera barrera; el aislamiento es la segunda. Nada de esto
 * se puede verificar con un test de renderizado: se verifica sobre el código fuente, igual
 * que ya hacen import/isolation y export-isolation.
 */
describe("preview de la firma — aislamiento (verificación de código fuente)", () => {
  const raw = readFileSync(
    join(appRoot, "components/communications/email-signature-preview.tsx"),
    "utf8",
  );

  /**
   * Se evalúa el CÓDIGO, no los comentarios. El componente documenta en prosa qué NO usa
   * ("sin allow-scripts", "no se usa dangerouslySetInnerHTML"), y esas menciones harían
   * fallar las aserciones de ausencia si se leyera el archivo crudo.
   */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("usa un iframe sandbox", () => {
    assert.match(src, /<iframe/);
    assert.match(src, /sandbox=""/);
  });

  it("el sandbox no habilita scripts, mismo origen, formularios ni navegación", () => {
    assert.doesNotMatch(src, /allow-scripts/);
    assert.doesNotMatch(src, /allow-same-origin/);
    assert.doesNotMatch(src, /allow-forms/);
    assert.doesNotMatch(src, /allow-top-navigation/);
    assert.doesNotMatch(src, /allow-popups/);
  });

  it("no usa dangerouslySetInnerHTML sobre el DOM principal", () => {
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
  });

  it("no puede enviar emails ni llamar a Resend", () => {
    assert.doesNotMatch(src, /sendEnrollmentApprovedEmail|api\.resend\.com|resend/i);
    assert.doesNotMatch(src, /fetch\(/);
  });

  it("muestra HTML y texto plano, y los estados sin logo y sin nota", () => {
    assert.match(src, /srcDoc/);
    assert.match(src, /<pre/); // el texto plano se muestra tal cual
    assert.match(src, /sin logo/i);
    assert.match(src, /sin nota/i);
  });

  it("aclara que es la firma institucional y que habrá firmante personal", () => {
    assert.match(src, /firma institucional/i);
    assert.match(src, /firmante personal/i);
  });
});
