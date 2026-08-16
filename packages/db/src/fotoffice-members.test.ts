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

  it("createMember siempre setea workspaceId en el data", () => {
    const fn = fnBody("function createMember", "export async function updateMember");
    assert.match(fn, /data:\s*\{\s*workspaceId,/);
  });

  it("F/J: updateMember usa updateMany({ id, workspaceId }), NUNCA update({ where: { id } }) — un memberId de otro workspace matchea 0 filas", () => {
    const fn = fnBody("function updateMember", "export function listMemberCategories");
    assert.match(fn, /updateMany\(\{\s*where:\s*\{\s*id:\s*memberId,\s*workspaceId\s*\},\s*data\s*\}\)/);
    assert.doesNotMatch(fn, /prisma\.member\.update\(/);
    assert.match(fn, /if\s*\(result\.count === 0\)\s*return null;/);
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
