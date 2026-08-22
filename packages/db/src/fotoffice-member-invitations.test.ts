import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, "fotoffice-member-invitations.ts"), "utf8");

/** Se evalúa el CÓDIGO, no los comentarios: la prosa explica justamente lo que NO se hace. */
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("aceptación de invitación — garantías estructurales", () => {
  it("todo ocurre dentro de una transacción", () => {
    assert.match(src, /prisma\.\$transaction\(async \(tx\) =>/);
    // Ninguna escritura por fuera de `tx`: eso rompería la atomicidad.
    assert.doesNotMatch(src, /await prisma\.(member|user|memberAudit|memberInvitation)\./);
  });

  it("reclama la invitación con guarda de concurrencia antes de tocar nada", () => {
    const claim = src.slice(src.indexOf("updateMany"), src.indexOf("claimed.count"));
    for (const guard of ["acceptedAt: null", "revokedAt: null", "expiresAt: { gt: now }"]) {
      assert.ok(claim.includes(guard), `falta la guarda ${guard}`);
    }
    assert.match(src, /if \(claimed\.count !== 1\) throw/);
  });

  it("la vinculación exige que el socio siga sin usuario", () => {
    assert.match(src, /data: \{ userId \}/);
    assert.match(src, /where: \{ id: inv\.memberId, workspaceId: inv\.workspaceId, userId: null \}/);
    assert.match(src, /if \(linked\.count !== 1\) throw/);
  });

  it("no crea membresías de workspace ni asigna roles", () => {
    assert.doesNotMatch(src, /workspaceMembership/);
    assert.doesNotMatch(src, /WORKSPACE_OWNER|WORKSPACE_ADMIN|STAFF/);
  });

  it("no crea workspaces", () => {
    assert.doesNotMatch(src, /workspace\.create|ensureFotoffice/);
  });
});

describe("verificación del email al aceptar", () => {
  const block = src.slice(src.indexOf("tx.user.updateMany"), src.indexOf("INVITE_ACCEPTED"));

  it("se marca dentro de la misma transacción de aceptación", () => {
    assert.match(src, /tx\.user\.updateMany/);
    assert.doesNotMatch(src, /prisma\.user\.updateMany/);
  });

  it("solo si estaba en null: una fecha previa se conserva", () => {
    assert.match(block, /emailVerifiedAt: null/);
  });

  it("alcanza únicamente al usuario que aceptó", () => {
    assert.match(block, /id: userId/);
  });

  it("nunca modifica el email", () => {
    assert.doesNotMatch(block, /email:/);
  });

  /**
   * El orden importa: se marca DESPUÉS de reclamar la invitación y de vincular. Si cualquiera
   * de esas dos guardas falla, la transacción se aborta y el email no queda verificado.
   */
  it("ocurre después de las guardas de invitación y vinculación", () => {
    const claimAt = src.indexOf("claimed.count");
    const linkAt = src.indexOf("linked.count");
    const verifyAt = src.indexOf("tx.user.updateMany");
    assert.ok(claimAt > 0 && linkAt > claimAt, "las guardas deben ir primero");
    assert.ok(verifyAt > linkAt, "la verificación debe ir después de vincular");
  });

  it("usa la misma marca de tiempo que la aceptación", () => {
    assert.match(block, /emailVerifiedAt: now/);
  });
});

describe("auditoría del ciclo", () => {
  it("registra la aceptación y la vinculación como eventos distintos", () => {
    assert.match(src, /action: "INVITE_ACCEPTED"/);
    assert.match(src, /action: "USER_LINKED"/);
  });

  it("la vinculación deja el cambio de userId en el historial", () => {
    assert.match(src, /changes: \{ userId: \{ before: null, after: userId \} \}/);
  });

  it("no se registra el token en ningún lado", () => {
    assert.doesNotMatch(src, /rawToken|tokenPlano/);
    assert.doesNotMatch(src, /console\./);
  });
});
