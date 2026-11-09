import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { csvContactos, filtrosDesdeQuery } from "@/lib/agentes/buscador/consultas-panel";
import { diaArgentino } from "@/lib/agentes/periodista/horario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Exportar CSV» de Contactos DNX, con los mismos filtros que la lista (sin paginar).
 *
 * **Vive bajo `/api/admin/` pero NO hereda el guardia de `app/(shell)/admin/layout.tsx`**: un
 * layout sólo protege páginas. Acá se verifica a mano el mismo permiso: super admin de plataforma.
 */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión." }, { status: 401 });
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return NextResponse.json({ error: "Sólo un super admin puede exportar Contactos DNX." }, { status: 403 });
  }

  const q = new URL(request.url).searchParams;
  const csv = await csvContactos(filtrosDesdeQuery((k) => q.get(k) ?? undefined));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-dnx-${diaArgentino(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
