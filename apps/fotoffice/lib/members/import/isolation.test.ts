import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..", "..");

describe("importación masiva de socios — aislamiento, permisos, atomicidad (verificación de código fuente)", () => {
  const actionsSrc = readFileSync(join(appRoot, "app/actions/members-import.ts"), "utf8");

  it("STAFF no puede importar: ambas acciones exigen requireMembersManageContext (OWNER/ADMIN), no requireMembersContext", () => {
    const validateFn = actionsSrc.slice(
      actionsSrc.indexOf("export async function validateMemberImportAction"),
      actionsSrc.indexOf("export type MemberImportConfirmState"),
    );
    const confirmFn = actionsSrc.slice(actionsSrc.indexOf("export async function confirmMemberImportAction"));
    assert.match(validateFn, /requireMembersManageContext/);
    assert.match(confirmFn, /requireMembersManageContext/);
  });

  it("el workspaceId nunca viene del CSV/cliente: siempre se usa el workspace resuelto por sesión", () => {
    assert.doesNotMatch(actionsSrc, /formData\.get\(["']workspaceId["']\)/);
    assert.match(actionsSrc, /bulkCreateMembers\(workspace\.id/);
  });

  it("las categorías y duplicados existentes se resuelven SIEMPRE contra el workspace activo (loadWorkspaceLookups(workspace.id))", () => {
    assert.match(actionsSrc, /loadWorkspaceLookups\(workspace\.id\)/);
  });

  it("no crea cuentas User: la importación nunca llama prisma.user.create ni envía userId", () => {
    assert.doesNotMatch(actionsSrc, /prisma\.user\.create/);
    assert.doesNotMatch(actionsSrc, /userId:/);
  });

  it("confirmMemberImportAction vuelve a validar (no confía en filas ya aprobadas del cliente) antes de insertar", () => {
    const confirmFn = actionsSrc.slice(actionsSrc.indexOf("export async function confirmMemberImportAction"));
    assert.match(confirmFn, /parseAndValidateMemberImport/);
    assert.match(confirmFn, /errorCount > 0/);
  });

  it("respeta el límite de filas también en el paso de confirmación, no solo en la validación", () => {
    const confirmFn = actionsSrc.slice(actionsSrc.indexOf("export async function confirmMemberImportAction"));
    assert.match(confirmFn, /MEMBER_IMPORT_MAX_ROWS/);
  });

  it("la creación es atómica: bulkCreateMembers usa prisma.$transaction (todo o nada), no un loop de creates sueltos", () => {
    const dbSrc = readFileSync(join(appRoot, "..", "..", "packages/db/src/fotoffice-members.ts"), "utf8");
    const fn = dbSrc.slice(dbSrc.indexOf("export function bulkCreateMembers"));
    assert.match(fn, /prisma\.\$transaction/);
  });

  it("el link «Importar socios» del padrón solo se muestra cuando canManage (no a STAFF)", () => {
    const pageSrc = readFileSync(join(appRoot, "app/(shell)/members/page.tsx"), "utf8");
    const actionsBlock = pageSrc.slice(pageSrc.indexOf("canManage ? ("), pageSrc.indexOf(") : undefined"));
    assert.match(actionsBlock, /members\/import/);
  });

  it("la página /members/import exige requireMembersManageContext del lado del servidor (no solo ocultar el link)", () => {
    const importPageSrc = readFileSync(join(appRoot, "app/(shell)/members/import/page.tsx"), "utf8");
    assert.match(importPageSrc, /requireMembersManageContext/);
  });
});
