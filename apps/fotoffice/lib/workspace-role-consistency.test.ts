import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

/**
 * Invariante: el rol que decide QUÉ MUESTRA el menú lateral y el rol que exigen las
 * páginas del módulo Socios tienen que salir de la MISMA resolución.
 *
 * Cuando no era así, el layout aceptaba un respaldo a la tabla legacy `Membership` y
 * `requireMembersContext` no: el menú ofrecía "Solicitudes", "Cuotas", "Carnets",
 * "Diseñador", "Categorías" y "Valores y calendario", y la página rebotaba a
 * `/members?forbidden=manage`. El menú prometía algo que la página negaba.
 *
 * Se verifica sobre el código fuente, igual que `members/export-isolation.test.ts`:
 * el fallo era una diferencia entre dos consultas, no un valor que un test unitario
 * de una función pura pueda observar.
 */
describe("resolución de rol de workspace — menú y páginas leen lo mismo", () => {
  const roleSrc = readFileSync(join(here, "workspace-role.ts"), "utf8");
  const layoutSrc = readFileSync(join(appRoot, "app/(shell)/layout.tsx"), "utf8");
  const membersAccessSrc = readFileSync(join(here, "members/access.ts"), "utf8");
  const workspaceHomeSrc = readFileSync(join(appRoot, "app/workspace/page.tsx"), "utf8");

  it("hay UNA sola función que resuelve el rol, y consulta solo `workspaceMembership`", () => {
    assert.match(roleSrc, /export async function resolveWorkspaceRole/);
    assert.match(roleSrc, /prisma\.workspaceMembership\.findUnique/);
    // El respaldo legacy es justamente lo que producía la incoherencia.
    assert.doesNotMatch(roleSrc, /prisma\.membership\b/);
  });

  it("el layout que alimenta el menú usa esa función y no consulta la tabla legacy", () => {
    assert.match(layoutSrc, /resolveWorkspaceRole/);
    assert.doesNotMatch(layoutSrc, /prisma\.membership\b/);
  });

  it("los guards del módulo Socios usan esa misma función", () => {
    assert.match(membersAccessSrc, /resolveWorkspaceRole/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.workspaceMembership/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.membership\b/);
  });

  it("los dos flags del menú (Socios y Configuración) salen del MISMO rol resuelto", () => {
    // Un solo `const` con el rol: si mañana alguien resuelve uno de los dos flags por otro
    // camino, esta línea deja de matchear y el test cae.
    assert.match(
      layoutSrc,
      /const activeRole = workspace !== null \? await resolveWorkspaceRole\(user\.id, workspace\.id\) : null;/,
    );
    assert.match(layoutSrc, /canManageMembers\(activeRole\)/);
    assert.match(layoutSrc, /canManageWorkspaceSettings\(activeRole\)/);
  });

  it("el inicio del workspace decide las tarjetas con la misma resolución que el menú", () => {
    // `app/workspace/page.tsx` lista las mismas pantallas que `shell-nav` vía
    // `lib/modules/submodules.ts`: si resolviera el rol distinto, volvería la incoherencia
    // por otra puerta.
    assert.match(workspaceHomeSrc, /resolveWorkspaceRole/);
    assert.doesNotMatch(workspaceHomeSrc, /prisma\.membership\b/);
  });
});
