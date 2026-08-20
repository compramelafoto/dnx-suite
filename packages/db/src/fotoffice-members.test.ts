import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "fotoffice-members.ts"), "utf8");

function fnBody(name: string, nextName: string): string {
  const start = src.indexOf(`export ${name}`) >= 0 ? src.indexOf(`export ${name}`) : src.indexOf(name);
  const end = src.indexOf(nextName, start);
  assert.ok(start >= 0 && end > start, `no se encontró el cuerpo de ${name}`);
  return src.slice(start, end);
}

describe("fotoffice-members repository — aislamiento por workspace en código", () => {
  it("A: searchMembers siempre filtra por workspaceId (padrón nunca es global)", () => {
    const fn = fnBody("function searchMembers", "export async function countMembersByStatus");
    assert.match(fn, /const where[^=]*=\s*\{\s*\n\s*workspaceId,/);
  });

  it("B: la búsqueda contempla nombre, apellido, número de socio, email y documento", () => {
    const fn = fnBody("function searchMembers", "export async function countMembersByStatus");
    for (const field of ["firstName", "lastName", "memberNumber", "email", "documentNumber"]) {
      assert.match(fn, new RegExp(`${field}:\\s*\\{\\s*contains:\\s*search`));
    }
  });

  it("C: searchMembers acepta filtro por categoryId", () => {
    const fn = fnBody("function searchMembers", "export async function countMembersByStatus");
    assert.match(fn, /categoryId:\s*filters\.categoryId/);
  });

  it("D: searchMembers acepta filtro por status", () => {
    const fn = fnBody("function searchMembers", "export async function countMembersByStatus");
    assert.match(fn, /status:\s*filters\.status/);
  });

  it("searchMembers pagina (skip/take), no carga todo el padrón para filtrar en el browser", () => {
    const fn = fnBody("function searchMembers", "export async function countMembersByStatus");
    assert.match(fn, /skip:\s*\(page\s*-\s*1\)\s*\*\s*pageSize/);
    assert.match(fn, /take:\s*pageSize/);
  });

  it("countMembersByStatus agrupa por workspace, no global", () => {
    const fn = fnBody("function countMembersByStatus", "export function getMember");
    assert.match(fn, /where:\s*\{\s*workspaceId\s*\}/);
  });

  it("getMember usa findFirst con id + workspaceId (NO findUnique solo por id)", () => {
    const fn = fnBody("function getMember", "export function createMember");
    assert.match(fn, /findFirst/);
    assert.doesNotMatch(fn, /findUnique/);
    assert.match(fn, /where:\s*\{\s*id:\s*memberId,\s*workspaceId\s*\}/);
  });

  it("createMember: Member puede crearse sin userId (campo no exigido en el input)", () => {
    const type = src.slice(
      src.indexOf("export type CreateMemberInput"),
      src.indexOf("export type UpdateMemberInput"),
    );
    assert.match(type, /userId\?:\s*number \| null;/);
    assert.doesNotMatch(type, /\n\s*userId:\s*number/);
  });

  it("bulkCreateMembers usa prisma.$transaction (todo o nada), y setea workspaceId en cada fila", () => {
    const fn = src.slice(
      src.indexOf("export function bulkCreateMembers"),
      src.indexOf("export function listMemberCategories"),
    );
    assert.match(fn, /prisma\.\$transaction/);
    assert.match(fn, /workspaceId,\s*\.\.\.input/);
  });

  it("listMemberIdentifiersForWorkspace filtra por workspace y trae SOLO identificadores únicos (memberNumber/documento/email)", () => {
    const fn = src.slice(
      src.indexOf("export async function listMemberIdentifiersForWorkspace"),
      src.indexOf("export function listMemberCategories"),
    );
    assert.match(fn, /where:\s*\{\s*workspaceId\s*\}/);
    // `email` se sumó a propósito: es el TERCER identificador con restricción única por
    // workspace (@@unique([workspaceId, email])), igual que memberNumber y documentType+
    // documentNumber, y el import necesita los tres para avisar los choques en el preview
    // en vez de abortar la transacción entera recién al insertar.
    // El resto de los datos personales sigue prohibido: nombre, apellido y teléfono no son
    // identificadores únicos y no hacen falta para detectar duplicados.
    assert.doesNotMatch(fn, /firstName|lastName|phone/);
  });

  it("createMember siempre setea workspaceId en el data", () => {
    const fn = fnBody("function createMember", "export async function updateMember");
    assert.match(fn, /data:\s*\{\s*workspaceId,/);
  });

  it("F/J: updateMember usa updateMany con id + workspaceId (+ updatedAt de concurrencia), NUNCA update({ where: { id } }) — un memberId de otro workspace matchea 0 filas", () => {
    const fn = fnBody("async function updateMember", "/** Igual que `getMember`");
    // El aislamiento sigue intacto: id y workspaceId siempre en el where. Se le sumó
    // `updatedAt` como testigo de concurrencia optimista (ver los tests de MemberAudit).
    assert.match(fn, /updateMany\(\{\s*where:\s*\{\s*id:\s*memberId,\s*workspaceId,/);
    assert.doesNotMatch(fn, /prisma\.member\.update\(/);
    // El socio inexistente/de otro workspace devuelve null; el conflicto de concurrencia
    // lanza MemberConcurrencyError. Son casos distintos a propósito.
    assert.match(fn, /if \(!before\) return null;/);
  });

  it("K: listMemberCategories con onlyActive filtra isActive:true en el where", () => {
    const fn = fnBody("function listMemberCategories", "export function getMemberCategory");
    assert.match(fn, /isActive:\s*options\.onlyActive\s*\?\s*true\s*:\s*undefined/);
  });

  it("getMemberCategory usa findFirst con id + workspaceId", () => {
    const fn = fnBody("function getMemberCategory", "export function createMemberCategory");
    assert.match(fn, /findFirst/);
    assert.match(fn, /where:\s*\{\s*id:\s*categoryId,\s*workspaceId\s*\}/);
  });

  it("createMemberCategory siempre setea workspaceId en el data", () => {
    const fn = fnBody("function createMemberCategory", "export type UpdateMemberCategoryInput");
    assert.match(fn, /data:\s*\{\s*\n\s*workspaceId,/);
  });

  it("updateMemberCategory usa updateMany({ id, workspaceId }), igual patrón que updateMember", () => {
    const fn = src.slice(src.indexOf("export async function updateMemberCategory"));
    assert.match(fn, /updateMany\(\{\s*where:\s*\{\s*id:\s*categoryId,\s*workspaceId\s*\},\s*data\s*\}\)/);
    assert.doesNotMatch(fn, /prisma\.memberCategory\.update\(/);
  });

  it("ninguna función expone una firma sin workspaceId como primer parámetro (incluidas las async)", () => {
    const signatures = [...src.matchAll(/export (?:async )?function (\w+)\(([^)]*)\)/g)];
    assert.ok(signatures.length >= 9, "se esperaban al menos 9 funciones exportadas");
    for (const [, name, params] of signatures) {
      assert.match(params.trim(), /^workspaceId: string/, `${name} debe recibir workspaceId como primer parámetro`);
    }
  });
});

describe("MemberAudit — atomicidad, concurrencia e inmutabilidad", () => {
  const auditSrc = readFileSync(join(here, "fotoffice-member-audit.ts"), "utf8");

  it("createMember envuelve socio + auditoría en la MISMA transacción", () => {
    const fn = fnBody("function createMember", "/** Estado inicial del socio");
    assert.match(fn, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(fn, /tx\.member\.create/);
    assert.match(fn, /tx\.memberAudit\.create/);
  });

  it("updateMember lee el estado anterior DENTRO de la transacción (no antes)", () => {
    const fn = fnBody("async function updateMember", "/** Igual que `getMember`");
    assert.match(fn, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(fn, /tx\.member\.findFirst\(\{ where: \{ id: memberId, workspaceId \} \}\)/);
  });

  it("CONCURRENCIA: el update exige el updatedAt previo además de id + workspaceId", () => {
    const fn = fnBody("async function updateMember", "/** Igual que `getMember`");
    assert.match(fn, /tx\.member\.updateMany/);
    assert.match(fn, /updatedAt: options\.expectedUpdatedAt \?\? before\.updatedAt/);
  });

  it("CONCURRENCIA: si no afecta exactamente 1 fila, aborta la transacción entera", () => {
    const fn = fnBody("async function updateMember", "/** Igual que `getMember`");
    assert.match(fn, /if \(result\.count !== 1\) throw new MemberConcurrencyError\(\)/);
    // El throw está ANTES del create de auditoría: un conflicto no deja rastro en el historial.
    assert.ok(
      fn.indexOf("throw new MemberConcurrencyError()") < fn.indexOf("tx.memberAudit.create"),
      "el error de concurrencia debe lanzarse antes de crear la auditoría",
    );
  });

  it("una operación que no cambia nada NO crea auditoría", () => {
    const fn = fnBody("async function updateMember", "/** Igual que `getMember`");
    assert.match(fn, /if \(!hasChanges\(changes\)\) return getMemberTx/);
  });

  it("bulkCreateMembers mantiene todo-o-nada y audita cada socio creado", () => {
    const fn = fnBody("function bulkCreateMembers", "export type MemberAuditRecord");
    assert.match(fn, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(fn, /tx\.member\.create/);
    assert.match(fn, /tx\.memberAudit\.create/);
    assert.match(fn, /batchId: options\.batchId/);
  });

  it("listMemberAudits filtra por workspaceId además de memberId (aislamiento)", () => {
    const start = src.indexOf("export function listMemberAudits");
    assert.ok(start >= 0, "listMemberAudits debe existir");
    const fn = src.slice(start);
    assert.match(fn, /where: \{ workspaceId, memberId \}/);
    // Tope de filas: nunca una consulta sin límite.
    assert.match(fn, /take: Math\.min\(/);
  });

  it("INMUTABILIDAD: no existe ningún update ni delete de memberAudit en el repositorio", () => {
    assert.doesNotMatch(src, /memberAudit\.(update|updateMany|delete|deleteMany|upsert)/);
    assert.doesNotMatch(auditSrc, /memberAudit\.(update|updateMany|delete|deleteMany|upsert)/);
  });

  it("el diff normaliza antes de comparar: null/\"\", espacios, mayúsculas de email y fechas", () => {
    assert.match(auditSrc, /function normalizeForCompare/);
    assert.match(auditSrc, /value instanceof Date.*getTime\(\)/s);
    assert.match(auditSrc, /field === "email" \? trimmed\.toLowerCase\(\)/);
    assert.match(auditSrc, /if \(trimmed === ""\) return null/);
  });

  it("el snapshot del actor no guarda tokens ni credenciales", () => {
    assert.doesNotMatch(auditSrc, /password|token|secret|hash/i);
  });
});
