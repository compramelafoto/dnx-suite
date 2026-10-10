import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { rsvpCsv, rsvpPurgeDue } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import { purgarAsistencias } from "@/lib/inauguracion/limpieza";
import { ordenarAsistencia } from "@/lib/inauguracion/orden";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BORRADOS = "Los datos de asistencia se borraron 30 días después del cierre de la muestra.";
const texto = (cuerpo: string, status: number) => new Response(cuerpo, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

/** La lista de asistencia en CSV para Excel (D20). Dueño, coorganización o super admin (`rsvp`). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/difusion")}`, req.url), 307);
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return texto("No encontramos esa muestra.", 404);
  if (!frenarPorUsuario("exportarAsistencias", usuario.id).allowed) return texto("Bajaste la lista muchas veces seguidas. Esperá un rato.", 429);
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA" }, usuario, "rsvp"),
    select: {
      slug: true, endsAt: true, rsvpPurgedAt: true,
      rsvps: { orderBy: { createdAt: "asc" }, take: 2000, select: { name: true, email: true, companions: true, status: true, createdAt: true } },
    },
  });
  if (!a) return texto("No encontramos esa muestra.", 404);
  const ahora = new Date();
  // Vencida: se borra en este momento y no se entrega (nadie ve datos vencidos, D22).
  if (rsvpPurgeDue(a.endsAt, ahora)) {
    if (a.rsvps.length || !a.rsvpPurgedAt) await purgarAsistencias(id, ahora);
    return texto(BORRADOS, 404);
  }
  if (a.rsvpPurgedAt) return texto(BORRADOS, 404);
  // El slug sólo tiene a-z, 0-9 y guiones: va seguro en la cabecera.
  return new Response(rsvpCsv(ordenarAsistencia(a.rsvps)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistencia-${a.slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
