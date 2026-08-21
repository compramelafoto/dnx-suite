import { NextRequest, NextResponse } from "next/server";
import { listMembersForExport } from "@repo/db/fotoffice-members";
import { resolveMembersExportContext } from "@/lib/members/access";
import {
  buildExportFilename,
  buildMembersCsv,
  hasActiveFilters,
  parseExportFilters,
} from "@/lib/members/export";

export const runtime = "nodejs";
// El padrón cambia con cada alta: nunca servir una versión cacheada.
export const dynamic = "force-dynamic";

/**
 * Descarga del padrón en CSV. Nunca es pública: exige sesión, módulo `members` habilitado y
 * rol OWNER/ADMIN, todo verificado en el servidor. Ocultar el botón no es una protección.
 *
 * Cualquier denegación responde 404 (no 401/403) y sin cuerpo explicativo: distinguir "no
 * tenés permiso" de "no existe" le confirmaría a un tercero qué workspaces y módulos existen.
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveMembersExportContext();
  if (!ctx) return new NextResponse(null, { status: 404 });

  // Los filtros se reconstruyen y validan acá; el `workspaceId` sale SIEMPRE de la sesión,
  // nunca de la URL. El navegador no puede pedir filas de otro workspace ni una lista de ids.
  const filters = parseExportFilters(req.nextUrl.searchParams);

  const members = await listMembersForExport(ctx.workspace.id, filters);
  const csv = buildMembersCsv(members);
  const filename = buildExportFilename(
    ctx.workspace.name,
    hasActiveFilters(filters) ? "filtrados" : "todos",
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // El nombre ya viene saneado a [a-z0-9-] por buildExportFilename: no puede inyectar
      // cabeceras ni saltos de línea.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      // Datos personales: que ningún intermediario los guarde ni los indexe.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
