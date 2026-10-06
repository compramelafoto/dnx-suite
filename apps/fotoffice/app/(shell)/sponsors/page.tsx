import Link from "next/link";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { requireSponsorsViewer } from "@/lib/sponsors/access";
import { listWorkspaceSponsors } from "@/lib/sponsors/repository";
import { sponsorsWriteBlockedReason } from "@/lib/sponsors/clients";
import { placementLabel } from "@/lib/sponsors/constants";
import { diaArgentino, fechaCorta } from "@/lib/sponsors/slots";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  desvinculado: "El sponsor ya no figura en la institución y sus espacios quedaron libres.",
};

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, canManage } = await requireSponsorsViewer();
  const params = await searchParams;
  const sponsors = await listWorkspaceSponsors(workspace.id);
  const bloqueo = sponsorsWriteBlockedReason();
  const puedeEditar = canManage && !bloqueo;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sponsors"
        description="Las marcas que acompañan a la institución y en qué lugar del sitio y del portal aparece cada una. La ficha de cada marca es la misma en toda la red de DNX."
        actions={
          puedeEditar ? (
            <Link href="/sponsors/nuevo" className="fo-btn fo-btn-primary text-sm">
              Agregar sponsor
            </Link>
          ) : null
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-alert-success p-4 text-sm">{AVISOS[params.ok] ?? "Listo."}</p> : null}
      {canManage && bloqueo ? (
        <p className="fo-alert-warning p-4 text-sm">
          Por ahora los sponsors se pueden ver pero no cambiar: falta conectar FOTOFFICE con la base común
          de sponsors de DNX.
        </p>
      ) : null}

      {sponsors.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Handshake className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay sponsors</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Sumá las marcas que acompañan a la institución. Si ya trabajan con otra plataforma de DNX,
              las encontrás en el buscador con su logo cargado.
            </p>
          </div>
          {puedeEditar ? (
            <Link href="/sponsors/nuevo" className="fo-btn fo-btn-primary text-sm">
              Agregar el primero
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sponsors.map((s) => (
            <li key={s.partnerId}>
              <Link
                href={`/sponsors/${s.partnerId}`}
                className="fo-card flex h-full items-start gap-4 p-4 transition-colors hover:bg-[var(--fo-surface-hover)]"
              >
                <SponsorLogo name={s.name} src={s.logoSrc} className="size-14" />
                <div className="min-w-0 space-y-1.5">
                  <p className="truncate font-medium">{s.name}</p>
                  {s.placements.length === 0 ? (
                    <p className="text-xs text-[var(--fo-muted)]">Sin espacios asignados</p>
                  ) : (
                    <ul className="space-y-0.5 text-xs text-[var(--fo-text-secondary)]">
                      {s.placements.map((p) => (
                        <li key={p.bookingId}>
                          {placementLabel(p.placementKey)}
                          <span className="text-[var(--fo-muted)]">
                            {p.vigente
                              ? ` · hasta el ${fechaCorta(diaArgentino(p.endsAt, { esFin: true }))}`
                              : ` · desde el ${fechaCorta(diaArgentino(p.startsAt))}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
