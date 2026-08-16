import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

describe("aislamiento por workspace y ausencia de inputs de URL manual (verificación de código fuente)", () => {
  it("la API route de upload nunca lee un workspaceId del cliente: siempre usa el workspace resuelto por sesión", () => {
    const src = readFileSync(join(appRoot, "app/api/uploads/image/route.ts"), "utf8");
    assert.doesNotMatch(src, /formData\.get\(["']workspaceId["']\)/);
    assert.match(src, /ctx\.workspace\.id/);
    assert.match(src, /requireImageUploadContext/);
  });

  it("uploadFotofficeImage recibe scopeSegment (workspace) y lo usa para namespacear la key de storage", () => {
    const src = readFileSync(join(appRoot, "lib/images/upload.ts"), "utf8");
    assert.match(src, /scopeSegment/);
    assert.match(src, /basePrefix.*safeScope|safeScope.*prefix/s);
  });

  it("la pantalla Marca pública ya no tiene inputs de tipo texto/url para pegar una URL de logo o portada", () => {
    const src = readFileSync(join(appRoot, "components/module-settings-form.tsx"), "utf8");
    assert.doesNotMatch(src, /Logo \(URL\)/);
    assert.doesNotMatch(src, /Imagen de portada marca \(URL\)/);
    assert.doesNotMatch(src, /name="logoUrl"\s*\n\s*type="url"/);
    assert.match(src, /ImageUploadField/);
  });

  it("el formulario de Marca pública sigue enviando logoUrl/coverImageUrl (compatibilidad con la Server Action existente, sin cambiar el modelo)", () => {
    const src = readFileSync(join(appRoot, "components/module-settings-form.tsx"), "utf8");
    assert.match(src, /name="logoUrl"/);
    assert.match(src, /name="coverImageUrl"/);
  });

  it("subir/reemplazar imágenes exige contexto autorizado (OWNER/ADMIN) antes de tocar storage", () => {
    const src = readFileSync(join(appRoot, "app/api/uploads/image/route.ts"), "utf8");
    assert.match(src, /requireImageUploadContext/);
    assert.match(src, /status:\s*403/);
  });
});
