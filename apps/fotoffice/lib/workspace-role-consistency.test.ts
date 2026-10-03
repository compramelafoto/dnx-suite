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
  // El marco del panel (menú incluido) vive en `AdminShell`, que montan los dos layouts del
  // panel: `(shell)` y `/workspace`. Lo que hay que mirar es ese componente, no el layout.
  const layoutSrc = readFileSync(join(appRoot, "components/shell/admin-shell.tsx"), "utf8");
  const membersAccessSrc = readFileSync(join(here, "members/access.ts"), "utf8");
  const permissionsSrc = readFileSync(join(here, "permissions/module-access.ts"), "utf8");
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

  it("la función de niveles resuelve el rol con esa misma función", () => {
    assert.match(permissionsSrc, /resolveWorkspaceRole/);
    assert.doesNotMatch(permissionsSrc, /prisma\.membership\b/);
  });

  it("los guards del módulo Socios preguntan el nivel, no el rol por su cuenta", () => {
    assert.match(membersAccessSrc, /getModuleLevel/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.workspaceMembership/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.membership\b/);
  });

  it("los permisos de módulo del menú salen de UN solo cálculo de niveles", () => {
    assert.match(
      layoutSrc,
      /const levels = workspace !== null \? await getModuleLevels\(user\.id, workspace\.id\) : \{\};/,
    );
    assert.match(layoutSrc, /manageFlagFor\(levels, MEMBERS_MODULE_KEY/);
    assert.match(layoutSrc, /manageFlagFor\(levels, BOOKINGS_MODULE_KEY/);
    assert.match(layoutSrc, /manageFlagFor\(levels, RAFFLES_MODULE_KEY/);
    // Configuración sigue siendo de dueño/admin: no se delega (diseño de roles, §4).
    assert.match(layoutSrc, /canManageWorkspaceSettings\(activeRole\)/);
  });

  it("el inicio del workspace decide las tarjetas con la misma resolución que el menú", () => {
    // `app/workspace/page.tsx` lista las mismas pantallas que `shell-nav` vía
    // `lib/modules/submodules.ts`: si resolviera el rol distinto, volvería la incoherencia
    // por otra puerta.
    assert.match(workspaceHomeSrc, /resolveWorkspaceRole/);
    assert.match(workspaceHomeSrc, /getModuleLevels/);
    assert.doesNotMatch(workspaceHomeSrc, /prisma\.membership\b/);
  });

  it("la Comisión directiva exige dueño/admin en el layout y en cada acción", () => {
    // Las acciones son alcanzables por POST directo: esconder la pantalla no alcanza. Cada
    // `export async function` del archivo tiene que pasar por `requireCommissionAdmin()`.
    const comision = join(appRoot, "app/workspace/configuracion/comision");
    const layoutComision = readFileSync(join(comision, "layout.tsx"), "utf8");
    const actionsComision = readFileSync(join(comision, "actions.ts"), "utf8");

    assert.match(layoutComision, /await requireCommissionAdmin\(\)/);

    const exportadas = actionsComision.match(/export async function \w+/g) ?? [];
    const guardias = actionsComision.match(/await requireCommissionAdmin\(\)/g) ?? [];
    assert.ok(exportadas.length > 0, "actions.ts no exporta acciones");
    assert.ok(
      guardias.length >= exportadas.length,
      `hay ${exportadas.length} acciones exportadas y sólo ${guardias.length} llamadas a requireCommissionAdmin()`,
    );
  });
});
