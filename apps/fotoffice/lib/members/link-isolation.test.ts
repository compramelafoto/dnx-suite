import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const repoRoot = join(appRoot, "..", "..");

/**
 * Garantías del vínculo socio↔usuario que no se pueden expresar en un test unitario: se
 * verifican sobre el código fuente, igual que ya hacen import/isolation y export-isolation.
 */
describe("vínculo socio↔usuario — permisos, unicidad y atomicidad (código fuente)", () => {
  const actionsSrc = readFileSync(join(appRoot, "app/actions/member-access.ts"), "utf8");
  const acceptSrc = readFileSync(join(appRoot, "app/actions/accept-invitation.ts"), "utf8");
  const repoSrc = readFileSync(join(repoRoot, "packages/db/src/fotoffice-members.ts"), "utf8");
  const lookupSrc = readFileSync(join(repoRoot, "packages/db/src/fotoffice-user-lookup.ts"), "utf8");
  const invSrc = readFileSync(join(repoRoot, "packages/db/src/fotoffice-member-invitations.ts"), "utf8");
  const schemaSrc = readFileSync(join(repoRoot, "packages/db/prisma/schema.prisma"), "utf8");

  it("STAFF no puede gestionar accesos: TODAS las acciones exigen OWNER/ADMIN", () => {
    const exported = actionsSrc.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 5, "deben existir las acciones de vínculo");
    // Ninguna acción administrativa puede usar el contexto de solo lectura.
    assert.doesNotMatch(actionsSrc, /requireMembersContext\(\)/);
    // Se cuentan las INVOCACIONES, no la línea del import.
    const guards = actionsSrc.match(/await requireMembersManageContext\(\)/g) ?? [];
    assert.equal(guards.length, exported.length, "cada acción debe tener su guard");
  });

  it("la unicidad user↔member por workspace la sostiene la BASE, no solo el código", () => {
    assert.match(schemaSrc, /@@unique\(\[workspaceId, userId\]\)/);
  });

  it("un usuario ya vinculado a otro socio del mismo workspace es rechazado", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export async function linkMemberToUser"),
      repoSrc.indexOf("export async function unlinkMemberFromUser"),
    );
    assert.match(fn, /USER_TAKEN/);
    assert.match(fn, /where: \{ workspaceId, userId \}/);
  });

  it("no se vincula un socio que ya tiene cuenta", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export async function linkMemberToUser"),
      repoSrc.indexOf("export async function unlinkMemberFromUser"),
    );
    assert.match(fn, /ALREADY_LINKED/);
    // El update exige userId: null, así que dos confirmaciones simultáneas no vinculan dos veces.
    assert.match(fn, /userId: null, updatedAt/);
  });

  it("vincular y auditar ocurren en la MISMA transacción", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export async function linkMemberToUser"),
      repoSrc.indexOf("export async function unlinkMemberFromUser"),
    );
    assert.match(fn, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(fn, /USER_LINKED/);
    assert.match(fn, /tx\.memberAudit\.create/);
  });

  it("desvincular conserva el User: solo pone userId en null", () => {
    const fn = repoSrc.slice(repoSrc.indexOf("export async function unlinkMemberFromUser"));
    assert.match(fn, /data: \{ userId: null \}/);
    // Nunca borra usuarios ni membresías de workspace.
    assert.doesNotMatch(fn, /user\.delete|workspaceMembership\.delete/);
    assert.match(fn, /USER_UNLINKED/);
  });

  it("desvincular revoca las invitaciones pendientes, para que un enlace viejo no revincule", () => {
    const fn = repoSrc.slice(repoSrc.indexOf("export async function unlinkMemberFromUser"));
    assert.match(fn, /memberInvitation\.updateMany/);
    assert.match(fn, /revokedAt: new Date\(\)/);
  });

  it("desvincular exige motivo", () => {
    const fn = actionsSrc.slice(actionsSrc.indexOf("export async function unlinkMemberUserAction"));
    assert.match(fn, /normalizeReason/);
    assert.match(fn, /Escribí el motivo/);
  });

  it("NUNCA se vincula automáticamente por coincidencia de email", () => {
    // La búsqueda devuelve un candidato; el vínculo es una acción aparte que exige confirmación.
    const findFn = actionsSrc.slice(
      actionsSrc.indexOf("export async function findUserToLinkAction"),
      actionsSrc.indexOf("export async function linkMemberUserAction"),
    );
    assert.doesNotMatch(findFn, /linkMemberToUser/);
  });

  it("emails que no coinciden exigen una segunda confirmación explícita", () => {
    const fn = actionsSrc.slice(
      actionsSrc.indexOf("export async function linkMemberUserAction"),
      actionsSrc.indexOf("export async function inviteMemberAction"),
    );
    assert.match(fn, /confirmMismatch/);
  });

  it("la búsqueda de usuarios es por email EXACTO: no permite enumerar la base global", () => {
    const fn = lookupSrc.slice(lookupSrc.indexOf("export async function findLinkableUserByEmail"));
    assert.match(fn, /equals: normalized/);
    assert.doesNotMatch(fn, /contains:|startsWith:|findMany/);
    // Solo lo mínimo para confirmar identidad.
    assert.match(fn, /select: \{ id: true, email: true, name: true \}/);
  });

  it("nunca se persiste el token en claro: solo su hash", () => {
    assert.match(actionsSrc, /hashInvitationToken\(rawToken\)/);
    // El token crudo solo viaja al administrador en la respuesta, nunca al `create`.
    const fn = actionsSrc.slice(actionsSrc.indexOf("export async function inviteMemberAction"));
    assert.doesNotMatch(fn, /tokenHash: rawToken/);
  });

  it("aceptar exige sesión y revalida el email en el SERVIDOR", () => {
    assert.match(acceptSrc, /getAuthUser\(\)/);
    assert.match(acceptSrc, /emailsMatch\(user\.email, invitation\.email\)/);
  });

  it("dos aceptaciones simultáneas no pueden vincular dos veces", () => {
    const fn = invSrc.slice(invSrc.indexOf("export async function acceptMemberInvitation"));
    // Se "reclama" la invitación con un updateMany condicional: la segunda matchea 0 filas.
    assert.match(fn, /acceptedAt: null, revokedAt: null, expiresAt: \{ gt: now \}/);
    assert.match(fn, /if \(claimed\.count !== 1\) throw new MemberLinkError/);
    assert.match(fn, /prisma\.\$transaction\(async \(tx\)/);
  });

  it("aceptar no vincula si el socio ya tiene cuenta", () => {
    const fn = invSrc.slice(invSrc.indexOf("export async function acceptMemberInvitation"));
    assert.match(fn, /ALREADY_LINKED/);
  });

  it("vincular NO otorga rol administrativo: no se tocan roles ni membresías", () => {
    assert.doesNotMatch(repoSrc, /workspaceMembership\.(create|update|upsert)/);
    assert.doesNotMatch(actionsSrc, /role:\s*["']/);
  });

  it("no se crea un sistema de usuarios ni de contraseñas paralelo", () => {
    for (const src of [actionsSrc, acceptSrc]) {
      assert.doesNotMatch(src, /user\.create|bcrypt|passwordHash/);
    }
  });
});
