import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/**
 * La exportación se lleva datos personales de TODO el padrón de una sola vez. Estas garantías
 * no se pueden verificar con un test unitario del CSV: se verifican sobre el código fuente de
 * la ruta, igual que ya hace `import/isolation.test.ts`.
 */
describe("exportación del padrón — permisos y aislamiento (verificación de código fuente)", () => {
  const routeSrc = readFileSync(join(appRoot, "app/api/members/export/route.ts"), "utf8");
  const accessSrc = readFileSync(join(here, "access.ts"), "utf8");
  const repoSrc = readFileSync(
    join(appRoot, "..", "..", "packages/db/src/fotoffice-members.ts"),
    "utf8",
  );

  it("la ruta valida permisos en el SERVIDOR antes de cualquier consulta", () => {
    // Se mira el CUERPO de GET, no el archivo entero: en los imports el orden es alfabético
    // y no dice nada sobre el orden de ejecución.
    const body = routeSrc.slice(routeSrc.indexOf("export async function GET"));
    const guardIndex = body.indexOf("resolveMembersExportContext");
    const queryIndex = body.indexOf("listMembersForExport");
    assert.ok(guardIndex >= 0, "la ruta debe usar el guard de exportación");
    assert.ok(queryIndex >= 0, "la ruta debe leer el padrón");
    assert.ok(guardIndex < queryIndex, "el guard debe correr ANTES de leer el padrón");
  });

  it("toda denegación responde 404, sin distinguir sesión, permiso ni workspace inexistente", () => {
    assert.match(routeSrc, /if \(!ctx\) return new NextResponse\(null, \{ status: 404 \}\)/);
    // Nunca 401/403: revelarían que el recurso existe pero está protegido.
    assert.doesNotMatch(routeSrc, /status: 401|status: 403/);
  });

  it("STAFF no puede exportar: el guard exige canManageMembers (OWNER/ADMIN)", () => {
    const fn = accessSrc.slice(accessSrc.indexOf("export async function resolveMembersExportContext"));
    assert.match(fn, /canManageMembers/);
    assert.match(fn, /return null/);
  });

  it("el guard exige además que el módulo `members` esté habilitado para ese workspace", () => {
    const fn = accessSrc.slice(accessSrc.indexOf("export async function resolveMembersExportContext"));
    assert.match(fn, /isModuleEnabledForWorkspace/);
  });

  it("el guard NO redirige: un redirect en una descarga produciría un archivo con HTML", () => {
    const fn = accessSrc.slice(accessSrc.indexOf("export async function resolveMembersExportContext"));
    assert.doesNotMatch(fn, /redirect\(/);
  });

  it("el workspaceId sale de la SESIÓN, nunca de la URL", () => {
    assert.match(routeSrc, /listMembersForExport\(ctx\.workspace\.id/);
    // Si se leyera workspaceId de los parámetros, un usuario pediría datos de otro workspace.
    assert.doesNotMatch(routeSrc, /searchParams\.get\(["']workspaceId["']\)/);
  });

  it("la consulta de exportación filtra SIEMPRE por workspaceId", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export function listMembersForExport"),
      repoSrc.indexOf("export type MemberStatusCounts"),
    );
    assert.match(fn, /workspaceId,/);
    assert.match(fn, /prisma\.member\.findMany/);
  });

  it("la exportación tiene un tope duro de filas", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export function listMembersForExport"),
      repoSrc.indexOf("export type MemberStatusCounts"),
    );
    assert.match(fn, /take: MEMBER_EXPORT_MAX_ROWS/);
  });

  it("la respuesta no se cachea ni se indexa: son datos personales", () => {
    assert.match(routeSrc, /"Cache-Control": "no-store/);
    assert.match(routeSrc, /X-Robots-Tag/);
    assert.match(routeSrc, /dynamic = "force-dynamic"/);
  });

  it("se descarga como archivo, no se renderiza en el navegador", () => {
    assert.match(routeSrc, /Content-Disposition.*attachment/);
    assert.match(routeSrc, /text\/csv/);
  });

  it("solo expone GET: no hay forma de mutar nada desde esta ruta", () => {
    assert.match(routeSrc, /export async function GET/);
    assert.doesNotMatch(routeSrc, /export async function (POST|PUT|PATCH|DELETE)/);
  });
});
