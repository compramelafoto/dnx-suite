import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

/** Todo el código de la app (sin pruebas), con la ruta relativa en formato posix. */
function fuentes(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        recorrer(abs);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        out.push({ rel: relative(appRoot, abs).split(sep).join("/"), src: readFileSync(abs, "utf8") });
      }
    }
  };
  for (const raiz of ["app", "lib", "components"]) recorrer(join(appRoot, raiz));
  return out;
}

/** Saca comentarios: una mención en un comentario no decide nada. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

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
    // El menú recibe los niveles enteros, no una bandera suelta por módulo armada a mano.
    assert.match(layoutSrc, /levels=\{levels\}/);
    assert.doesNotMatch(layoutSrc, /manageFlagFor/);
    // Las acciones sensibles que el menú necesita se calculan en el servidor con la misma puerta.
    // `getGrantedActions` recorre todo el catálogo: una acción nueva llega sola al menú.
    assert.match(layoutSrc, /getGrantedActions\(user\.id, workspace\.id\)/);
    assert.match(workspaceHomeSrc, /getGrantedActions\(user\.id, workspaceId\)/);
    // Configuración sigue siendo de dueño/admin: no se delega (diseño de roles, §4).
    assert.match(layoutSrc, /canManageWorkspaceSettings\(activeRole\)/);
  });

  it("el menú decide cada módulo por su nivel, no por banderas de rol", () => {
    const sidebarSrc = readFileSync(join(appRoot, "components/shell/shell-sidebar.tsx"), "utf8");
    const navSrc = readFileSync(join(appRoot, "components/shell/shell-nav.tsx"), "utf8");
    assert.match(sidebarSrc, /levels=\{levels\}/);
    assert.match(navSrc, /levels: ModuleLevels/);
    for (const viejo of ["canManageMembers", "canManageBookings", "canManageRaffles", "Enabled:"]) {
      assert.ok(!navSrc.includes(viejo), `shell-nav todavía recibe ${viejo}`);
      assert.ok(!sidebarSrc.includes(viejo), `shell-sidebar todavía recibe ${viejo}`);
    }
    // `canManageWorkspaceSettings` sólo decide lo que es de Configuración: la sección
    // Institución, la configuración de cursos (que guarda `app/actions/settings.ts`, dueño/admin)
    // y el dominio propio del sitio (`app/actions/website-domain.ts`, dueño/admin).
    const usos = navSrc.match(/\bcanManageWorkspaceSettings\b/g) ?? [];
    assert.match(navSrc, /const institucion: Item\[\] = canManageWorkspaceSettings/);
    assert.match(navSrc, /ve\(COURSES_SALES_MODULE_KEY\) && canManageWorkspaceSettings/);
    assert.match(navSrc, /canManageWorkspaceSettings\s*\?\s*\[\{ href: "\/website\/dominio"/);
    assert.equal(usos.length, 5, "canManageWorkspaceSettings se usa en el menú fuera de Configuración");
  });

  it("el inicio arma los números y las tarjetas por nivel, no por rol", () => {
    const loadSrc = readFileSync(join(here, "workspace-home/load.ts"), "utf8");
    assert.match(loadSrc, /homeWidgetGates\(/);
    assert.doesNotMatch(loadSrc, /canManageWorkspaceSettings/);
    assert.doesNotMatch(loadSrc, /\brole\b/);
    assert.doesNotMatch(workspaceHomeSrc, /manageFlagFor/);
    assert.match(workspaceHomeSrc, /hasLevel\(levels\[m\.key\]/);
  });

  it("la grilla de roles dibuja una casilla por acción del catálogo", () => {
    const grilla = readFileSync(
      join(appRoot, "app/workspace/configuracion/comision/roles/grilla.ts"),
      "utf8",
    );
    assert.match(grilla, /MODULE_ACTIONS/);
    assert.doesNotMatch(grilla, /Plata de proyectos/);
  });

  it("el aviso provisorio de la etapa 2 ya no existe", () => {
    const comision = join(appRoot, "app/workspace/configuracion/comision");
    assert.ok(!existsSync(join(comision, "aviso-acceso.tsx")), "aviso-acceso.tsx sigue existiendo");
    const conAviso = fuentes().filter(({ src }) => /AvisoAccesoTransitorio|aviso-acceso/.test(src));
    assert.deepEqual(conAviso.map((f) => f.rel), []);
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

/**
 * Invariante de la etapa 2b: fuera de Configuración, nadie decide el acceso por el rol crudo.
 *
 * Cada módulo pregunta su nivel (`getModuleLevels` / `hasModuleLevel` / `hasModuleAction`). Si
 * una pantalla nueva volviera a preguntar "¿es dueño o admin?", la grilla de la Comisión
 * directiva diría una cosa y la pantalla haría otra, que es justo lo que la etapa 2b vino a
 * cerrar.
 *
 * `canDesignTemplates` no está en la lista: desde la etapa 2b ES la decisión por nivel
 * (`members` MANAGE vía `hasModuleLevel`), no un chequeo de rol. `canCoordinateCoverages` y
 * `canManageMembers` se borraron en la etapa 2b (ya nadie las llamaba); quedan en la lista a
 * propósito, para que ninguna vuelva con el mismo nombre.
 */
describe("nadie fuera de Configuración decide el acceso por el rol crudo", () => {
  const PROHIBIDAS = ["canManageWorkspaceSettings", "canManageMembers", "canCoordinateCoverages"];

  // Cada entrada, con su razón. Agregar una acá es una decisión de diseño, no un trámite.
  const PERMITIDOS: { patron: RegExp; razon: string }[] = [
    { patron: /^app\/workspace\/configuracion\//, razon: "Configuración de la institución: no se delega" },
    { patron: /^app\/api\/integrations\//, razon: "conectar integraciones es de Configuración" },
    { patron: /^app\/onboarding\//, razon: "el alta de la institución la hace el dueño" },
    { patron: /^lib\/payments\/connect\/authz\.ts$/, razon: "conectar Mercado Pago es de Configuración" },
    { patron: /^lib\/commission\/access\.ts$/, razon: "la Comisión directiva es de Configuración" },
    { patron: /^app\/actions\/settings\.ts$/, razon: "ajustes del workspace y de venta de cursos" },
    { patron: /^app\/actions\/website-domain\.ts$/, razon: "el dominio propio es un dato de la institución" },
    { patron: /^components\/shell\/admin-shell\.tsx$/, razon: "sólo la sección Institución del menú" },
    {
      patron: /^lib\/website\/identity-access\.ts$/,
      razon: "logo y favicon son la identidad de la institución (Datos de la institución), no del sitio",
    },
    {
      patron: /^app\/workspace\/page\.tsx$/,
      razon: "sólo el aviso 'Completar los datos de la institución', que lleva a Configuración",
    },
    {
      patron: /^app\/workspace\/layout\.tsx$/,
      razon: "sólo el desvío al onboarding, que completa el dueño/admin; no decide el acceso al panel",
    },
    {
      patron: /^lib\/post-login\.ts$/,
      razon: "sólo el desvío al onboarding después del login, igual que el layout del panel",
    },
    // Las propias definiciones.
    { patron: /^lib\/workspace-settings-access\.ts$/, razon: "definición" },
  ];

  it("la lista de archivos que llaman a un chequeo por rol es la permitida", () => {
    const llamada = new RegExp(`(?<![\\w.])(?:${PROHIBIDAS.join("|")})\\s*\\(`, "g");
    const definicion = new RegExp(`function\\s+(?:${PROHIBIDAS.join("|")})\\s*\\(`, "g");
    const infractores = fuentes()
      .filter(({ src }) => {
        const limpio = sinComentarios(src);
        const llamadas = (limpio.match(llamada) ?? []).length;
        const definiciones = (limpio.match(definicion) ?? []).length;
        return llamadas > definiciones;
      })
      .map((f) => f.rel)
      .filter((rel) => !PERMITIDOS.some((p) => p.patron.test(rel)))
      .sort();
    assert.deepEqual(infractores, []);
  });

  it("la regla de escaneo detecta una llamada real y no una mención en un comentario", () => {
    const llamada = new RegExp(`(?<![\\w.])(?:${PROHIBIDAS.join("|")})\\s*\\(`);
    assert.ok(llamada.test(sinComentarios("const a = canManageWorkspaceSettings(role);")));
    assert.ok(!llamada.test(sinComentarios("// canManageWorkspaceSettings(role) decide")));
    assert.ok(!llamada.test(sinComentarios("/** `canManageMembers(role)` */ const x = 1;")));
  });
});
