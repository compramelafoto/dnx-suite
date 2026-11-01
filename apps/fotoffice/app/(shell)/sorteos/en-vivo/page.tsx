import Link from "next/link";
import { QrCode } from "lucide-react";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireRafflesViewer } from "@/lib/raffles/access";
import { fechaHora } from "@/lib/raffles/labels";
import { createLiveRaffleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SorteosEnVivoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace, canConduct } = await requireRafflesViewer();
  const params = await searchParams;
  const sorteos = await prisma.liveRaffle.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entrants: true, prizes: true, polls: true } } },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sorteos en vivo"
        description="Para congresos y eventos: la gente se anota escaneando un QR, contesta encuestas y el sorteo se hace en pantalla, frente a todos."
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}

      {canConduct ? (
        <form action={createLiveRaffleAction} className="fo-card flex flex-wrap items-end gap-3 p-5">
          <div className="fo-field-stack min-w-[16rem] flex-1">
            <label className="fo-label" htmlFor="title">
              Nuevo sorteo en vivo
            </label>
            <input id="title" name="title" className="fo-input" required placeholder="Congreso de Fotografía 2026" />
          </div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Crear
          </button>
        </form>
      ) : null}

      {sorteos.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <QrCode className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay sorteos en vivo</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Creá uno, cargale el logo, los premios con quién los dona y, si querés, algunas encuestas. Después
              imprimí el QR y abrí la pantalla del sorteador en el proyector.
            </p>
          </div>
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-3 font-medium">Sorteo</th>
                <th className="px-4 py-3 font-medium">Inscripción</th>
                <th className="px-4 py-3 text-right font-medium">Inscriptos</th>
                <th className="px-4 py-3 text-right font-medium">Premios</th>
                <th className="px-4 py-3 text-right font-medium">Encuestas</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {sorteos.map((s) => (
                <tr key={s.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/sorteos/en-vivo/${s.id}`} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-text-secondary)]">
                    {s.registrationOpen ? "Abierta" : "Cerrada"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s._count.entrants}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s._count.prizes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s._count.polls}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{fechaHora(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
