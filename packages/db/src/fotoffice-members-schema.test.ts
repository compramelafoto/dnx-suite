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

function enumBlock(name: string): string {
  const start = schema.indexOf(`enum ${name} {`);
  assert.ok(start >= 0, `enum ${name} no encontrado en schema.prisma`);
  const end = schema.indexOf("\n}", start);
  return schema.slice(start, end);
}

describe("schema.prisma — invariantes de Member/MemberCategory (multi-workspace)", () => {
  const member = modelBlock("Member");
  const category = modelBlock("MemberCategory");

  it("1. memberNumber es único DENTRO del workspace (@@unique([workspaceId, memberNumber]))", () => {
    assert.match(member, /@@unique\(\[workspaceId,\s*memberNumber\]\)/);
  });

  it("2. memberNumber NO es único globalmente (no hay @@unique([memberNumber]) suelto)", () => {
    assert.doesNotMatch(member, /@@unique\(\[memberNumber\]\)/);
    assert.doesNotMatch(member, /memberNumber\s+String\s+@unique\b/);
  });

  it("3. Member puede existir sin User: userId es opcional", () => {
    assert.match(member, /userId\s+Int\?/);
    assert.match(member, /user\s+User\?\s+@relation/);
  });

  it("4. la relación a User usa onDelete: SetNull (el Member sobrevive si se borra el User)", () => {
    assert.match(member, /user\s+User\?\s+@relation\([^)]*onDelete:\s*SetNull/);
  });

  it("5. un mismo User no puede ser Member dos veces del mismo Workspace, pero sí de Workspaces distintos (@@unique([workspaceId, userId]))", () => {
    assert.match(member, /@@unique\(\[workspaceId,\s*userId\]\)/);
    assert.doesNotMatch(member, /@@unique\(\[userId\]\)/);
    assert.doesNotMatch(member, /userId\s+Int\?\s+@unique\b/);
  });

  it("6. las categorías están aisladas por workspace (@@unique([workspaceId, name]), no global)", () => {
    assert.match(category, /@@unique\(\[workspaceId,\s*name\]\)/);
    assert.doesNotMatch(category, /@@unique\(\[name\]\)/);
  });

  it("documentNumber por sí solo NO es único (ni global ni por workspace) — no identifica una persona por sí solo", () => {
    assert.doesNotMatch(member, /documentNumber[^\n]*@unique\b/);
    assert.doesNotMatch(member, /@@unique\(\[documentNumber\]\)/);
    assert.doesNotMatch(member, /@@unique\(\[workspaceId,\s*documentNumber\]\)/);
  });

  it("pero (workspaceId, documentType, documentNumber) sí es único — evita duplicar por error el mismo documento en el mismo workspace", () => {
    assert.match(member, /@@unique\(\[workspaceId,\s*documentType,\s*documentNumber\]\)/);
  });

  it("Member tiene avatarUrl, con el mismo nombre que el resto del monorepo (no profileImageUrl)", () => {
    assert.match(member, /avatarUrl\s+String\?/);
    assert.doesNotMatch(member, /profileImageUrl/);
  });

  it("MemberStatus NO incluye PENDING (sin flujo de aprobación/autoregistro todavía)", () => {
    const status = enumBlock("MemberStatus");
    assert.doesNotMatch(status, /\bPENDING\b/);
    assert.match(status, /\bACTIVE\b/);
    assert.match(status, /\bSUSPENDED\b/);
    assert.match(status, /\bINACTIVE\b/);
  });

  it("MemberCategory NO tiene metadata genérica (sin caso de uso concreto todavía)", () => {
    assert.doesNotMatch(category, /metadata\s+Json\?/);
  });

  it("Member y MemberCategory pertenecen obligatoriamente a un Workspace (workspaceId no nullable)", () => {
    assert.match(member, /workspaceId\s+String\n/);
    assert.match(category, /workspaceId\s+String\n/);
  });

  it("MemberCategory NO tiene campos de precio/cuota/carnet acoplados (deferred a otro módulo)", () => {
    for (const forbidden of ["monthlyAmountCents", "enrollmentFeeCents", "billingDay", "cardTemplateId"]) {
      assert.doesNotMatch(category, new RegExp(forbidden));
    }
  });

  it("Member NO tiene campos de cuotas/pagos/carnet (deferred a otro módulo)", () => {
    for (const forbidden of ["amountCents", "mpAccessToken", "cardTemplateId", "publicToken"]) {
      assert.doesNotMatch(member, new RegExp(forbidden));
    }
  });
});
