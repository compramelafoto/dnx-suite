import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "prisma", "schema.prisma"), "utf8");

function modelBlock(name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `model ${name} no encontrado en schema.prisma`);
  const end = schema.indexOf("\n}", start);
  return schema.slice(start, end);
}

describe("schema.prisma — invariantes de la sincronización con Google Contacts", () => {
  const setting = modelBlock("WorkspaceContactSyncSetting");
  const link = modelBlock("WorkspaceContactLink");
  const integration = modelBlock("WorkspaceIntegration");

  it("1. el interruptor es uno por workspace y módulo", () => {
    assert.match(setting, /@@unique\(\[workspaceId,\s*moduleKey\]\)/);
  });

  it("2. el interruptor arranca APAGADO: nadie sube datos a Google sin pedirlo", () => {
    assert.match(setting, /enabled\s+Boolean\s+@default\(false\)/);
  });

  it("3. queda registrado quién lo encendió", () => {
    assert.match(setting, /enabledByUserId\s+Int\?/);
  });

  it("4. un socio no puede tener dos contactos", () => {
    assert.match(link, /@@unique\(\[workspaceId,\s*sourceType,\s*sourceId\]\)/);
  });

  it("5. un contacto no puede pertenecer a dos socios", () => {
    assert.match(link, /@@unique\(\[workspaceId,\s*resourceName\]\)/);
  });

  it("6. el vínculo guarda las DOS huellas: sin eso no se sabe qué lado cambió", () => {
    assert.match(link, /localFingerprint\s+String/);
    assert.match(link, /remoteFingerprint\s+String/);
  });

  it("7. la marca de 'dame solo lo que cambió' vive en la cuenta, no en el módulo", () => {
    // El syncToken de la People API es por cuenta. Guardarlo por módulo haría que dos
    // módulos encendidos se pisen el token y cada corrida recargue la agenda entera.
    assert.match(integration, /syncCursor\s+String\?/);
  });

  it("8. borrar un workspace se lleva lo suyo, y nada más", () => {
    assert.match(setting, /onDelete:\s*Cascade/);
    assert.match(link, /onDelete:\s*Cascade/);
  });
});
