import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/** Se evalúa el CÓDIGO, no los comentarios: la prosa explica justamente lo que NO se hace. */
function code(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Barrera contra el workspace fantasma.
 *
 * `ensureFotofficeWorkspaceForUser` le crea un workspace propio —con rol de dueño— a quien no
 * tiene ninguno. Es correcto para un fotógrafo nuevo y desastroso para un socio: los 152
 * socios de SFPR activando su acceso habrían generado 152 instituciones vacías.
 *
 * Esto no se puede verificar renderizando: se verifica sobre el código, igual que ya hacen
 * `preview-isolation` y `sender-isolation`.
 */
describe("aceptación de invitación — sin workspace fantasma", () => {
  const accept = code("app/actions/accept-invitation.ts");

  it("no redirige a /workspace", () => {
    assert.doesNotMatch(accept, /["'`]\/workspace/);
  });

  it("no llama ni importa ensureFotofficeWorkspaceForUser", () => {
    assert.doesNotMatch(accept, /ensureFotofficeWorkspaceForUser/);
    assert.doesNotMatch(accept, /ensure-workspace/);
  });

  it("el destino sale del resolutor centralizado del portal", () => {
    assert.match(accept, /resolvePortalDestination/);
  });

  it("no crea membresías de workspace al aceptar", () => {
    assert.doesNotMatch(accept, /workspaceMembership/);
    assert.doesNotMatch(accept, /WORKSPACE_OWNER|WORKSPACE_ADMIN|STAFF/);
  });

  it("revalida el estado del socio", () => {
    assert.match(accept, /canMemberUseInvitations/);
  });
});

describe("vinculación en base — sin permisos administrativos", () => {
  const link = readFileSync(
    join(appRoot, "..", "..", "packages/db/src/fotoffice-member-invitations.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /** Vincular es escribir `Member.userId`. Nada más: ni membresía, ni rol, ni workspace nuevo. */
  it("no crea WorkspaceMembership ni asigna roles", () => {
    assert.doesNotMatch(link, /workspaceMembership/);
    assert.doesNotMatch(link, /WORKSPACE_OWNER|WORKSPACE_ADMIN|STAFF/);
  });

  it("no crea workspaces", () => {
    assert.doesNotMatch(link, /workspace\.create|ensureFotoffice/);
  });
});

describe("portal del socio — frontera con el panel", () => {
  const access = code("lib/portal/access.ts");

  it("autoriza por ficha de socio, no por membresía de workspace", () => {
    assert.match(access, /member\.findFirst/);
    assert.doesNotMatch(access, /workspaceMembership/);
  });

  it("exige estado ACTIVE", () => {
    assert.match(access, /status: "ACTIVE"/);
  });
});
