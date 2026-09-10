import Link from "next/link";
import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireRafflesStaff } from "@/lib/raffles/access";
import { listRaffles } from "@/lib/raffles/repository";
import { fechaHora, raffleStatusLabel } from "@/lib/raffles/labels";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  cancelado: "El sorteo quedó cancelado.",
};

export default async function SorteosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, role } = await requireRafflesStaff();
  const params = await searchParams;
  const sorteos = await listRaffles(workspace.id);
  const puedeAdministrar = canManageWorkspaceSettings(role);

  const ahora = new Date();
  // Los que ya cerraron el padrón y siguen sin sellar. No es decoración: es lo que evita que
  // un sorteo quede colgado si la tarea programada no corrió.
  const sinSellar = sorteos.filter(
    (s) => s.status === "ANUNCIADO" && s.entriesCloseAt.getTime() <= ahora.getTime(),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sorteos"
        description="Participan los socios al día. El resultado sale de un número que produce un servicio público y de una lista congelada de antemano, así que cualquiera puede comprobar que no se arregló."
        actions={
          puedeAdministrar ? (
            <Link href="/sorteos/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo sorteo
            </Link>
          ) : null
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-alert-success p-4 text-sm">{AVISOS[params.ok] ?? "Listo."}</p>
      ) : null}

      {sinSellar.length > 0 ? (
        <div className="fo-alert-warning p-4 text-sm">
          <p className="font-medium">
            {sinSellar.length === 1
              ? "Hay un sorteo con el padrón vencido y sin sellar."
              : `Hay ${sinSellar.length} sorteos con el padrón vencido y sin sellar.`}
          </p>
          <ul className="mt-2 space-y-1">
            {sinSellar.map((s) => (
              <li key={s.id}>
                <Link href={`/sorteos/${s.id}`} className="underline">
                  {s.title}
                </Link>{" "}
                — cerró el {fechaHora(s.entriesCloseAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sorteos.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Ticket className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay ningún sorteo</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Un sorteo se arma con dos fechas —cuándo cierra el padrón y cuándo es el acto— y
              con los premios que donan las marcas aliadas.
            </p>
          </div>
          {puedeAdministrar ? (
            <Link href="/sorteos/nuevo" className="fo-btn fo-btn-primary text-sm">
              Crear el primero
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-3 font-medium">Sorteo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Cierra el padrón</th>
                <th className="px-4 py-3 font-medium">Acto</th>
                <th className="px-4 py-3 text-right font-medium">Participan</th>
                <th className="px-4 py-3 text-right font-medium">Premios</th>
              </tr>
            </thead>
            <tbody>
              {sorteos.map((s) => (
                <tr key={s.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/sorteos/${s.id}`} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                    {s.cancelReason ? (
                      <p className="text-xs text-[var(--fo-muted)]">{s.cancelReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-text-secondary)]">
                    {raffleStatusLabel(s.status)}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{fechaHora(s.entriesCloseAt)}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{fechaHora(s.drawsAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.entrantsCount ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s._count.prizes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-[var(--fo-muted)]">
        <Link href="/sorteos/entregas" className="underline">
          Premios pendientes de entrega
        </Link>
      </p>
    </div>
  );
}
