import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/**
 * Se evalúa el CÓDIGO, no los comentarios: la prosa explica justamente lo que NO se hace.
 *
 * El `//` de una URL no abre un comentario, así que se exige que no venga precedido de `:`.
 * Sin esa salvedad, `https://api.resend.com/emails` desaparecía junto con el resto de la línea.
 */
function code(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SEND_PATH = [
  "lib/communications/email-config.ts",
  "lib/communications/send-email.ts",
  "lib/communications/test-email.ts",
  "lib/presential-courses/email.ts",
  "app/workspace/configuracion/actions.ts",
];

/**
 * El remitente por defecto `no-reply@fotoffice.app` apuntaba a un dominio no verificado en
 * Resend: el proveedor rechazaba el envío y el resultado se perdía en silencio. Que no
 * vuelva por descuido es más fácil de garantizar acá que en una revisión.
 */
describe("camino de envío — sin remitentes inventados (verificación de código fuente)", () => {
  it.each(SEND_PATH)("%s no menciona el dominio no verificado", (file) => {
    assert.doesNotMatch(code(file), /fotoffice\.app/);
  });

  it.each(SEND_PATH)("%s no lleva ninguna dirección de email escrita a mano", (file) => {
    assert.doesNotMatch(code(file), /[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });

  it("el remitente sale del entorno y de ningún otro lado", () => {
    const config = code("lib/communications/email-config.ts");
    assert.match(config, /FOTOFFICE_NOTIFICATIONS_FROM/);
    // Nada de `env.X || "algo"`: un `||` con literal de texto sería un fallback.
    assert.doesNotMatch(config, /\|\|\s*["'`]/);
  });

  it("solo el transporte compartido habla con el proveedor", () => {
    assert.match(code("lib/communications/send-email.ts"), /api\.resend\.com/);
    for (const file of SEND_PATH.filter((f) => f !== "lib/communications/send-email.ts")) {
      assert.doesNotMatch(code(file), /api\.resend\.com/);
    }
  });

  it("el flujo de cursos ya no arma su propio request", () => {
    const courses = code("lib/presential-courses/email.ts");
    assert.doesNotMatch(courses, /fetch\(/);
    assert.doesNotMatch(courses, /Authorization/);
    assert.match(courses, /sendTransactionalEmail/);
  });
});

/**
 * El panel es un componente cliente. Si importara el módulo que consulta la base, Prisma
 * terminaría en el bundle del navegador.
 */
describe("panel de prueba — frontera cliente/servidor", () => {
  const panel = code("components/communications/test-email-panel.tsx");

  it("no importa el cliente de base de datos", () => {
    assert.doesNotMatch(panel, /@repo\/db/);
    assert.doesNotMatch(panel, /test-email-rate-limit/);
    assert.doesNotMatch(panel, /email-log/);
  });

  it("toma los topes de un módulo de constantes", () => {
    assert.match(panel, /from "@\/lib\/communications\/constants"/);
  });

  it("manda la confirmación como campo del formulario", () => {
    assert.match(panel, /name="confirm"/);
  });

  it("no precarga ningún destinatario", () => {
    assert.match(panel, /useState\(""\)/);
    assert.doesNotMatch(panel, /contactEmail|ownerEmail|defaultValue/);
  });
});
