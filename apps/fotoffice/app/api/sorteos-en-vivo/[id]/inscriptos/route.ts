import { prisma } from "@repo/db";
import { requireRafflesConductor } from "@/lib/raffles/access";
import { fechaHora } from "@/lib/raffles/labels";

export const dynamic = "force-dynamic";

const celda = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** La planilla de inscriptos de un sorteo en vivo, con quién ganó qué. Abre bien en Excel. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireRafflesConductor();
  const { id } = await params;
  const sorteo = await prisma.liveRaffle.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { entrants: { orderBy: { createdAt: "asc" } }, prizes: true },
  });
  if (!sorteo) return new Response("No encontrado", { status: 404 });

  const premioDe = new Map<string, string>();
  for (const p of sorteo.prizes) if (p.winnerEntrantId) premioDe.set(p.winnerEntrantId, p.title);

  const filas = [
    ["Nombre", "Apellido", "Celular", "DNI", "Correo", "Se anotó", "Ganó"].map(celda).join(";"),
    ...sorteo.entrants.map((e) =>
      [e.firstName, e.lastName, e.phone, e.dni, e.email, fechaHora(e.createdAt), premioDe.get(e.id)].map(celda).join(";"),
    ),
  ];
  return new Response(`﻿${filas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscriptos-${sorteo.publicCode}.csv"`,
    },
  });
}
