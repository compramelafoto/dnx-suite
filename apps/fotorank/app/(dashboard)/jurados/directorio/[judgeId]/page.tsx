import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import { getOrganizerViewJudgeDetail } from "../../../../lib/fotorank/judges/professionalDirectory";
import { prisma } from "@repo/db";
import { OrganizerJudgeDetailInvite } from "./OrganizerJudgeDetailInvite";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ judgeId: string }>;
}

export default async function DirectorioJuradoDetallePage({ params }: Props) {
  const { judgeId } = await params;
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return (
      <div className="p-8">
        <p className="text-sm text-fr-muted">{org.error}</p>
      </div>
    );
  }

  const detail = await getOrganizerViewJudgeDetail(judgeId);
  if (!detail) notFound();

  const contests = await prisma.fotorankContest.findMany({
    where: {
      organizationId: org.org.id,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      categories: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  return (
    <div className="space-y-10">
      <Link href="/jurados/directorio" className="text-sm text-fr-muted hover:text-gold">
        ← Directorio
      </Link>

      <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border border-fr-border bg-fr-bg">
            {detail.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-sans text-2xl font-semibold text-fr-primary">{detail.displayName}</h1>
              {detail.isVerifiedByPlatform ? (
                <span className="rounded-full bg-gold/15 px-3 py-0.5 text-xs font-medium text-gold ring-1 ring-gold/30">
                  Verificado
                </span>
              ) : null}
            </div>
            {detail.headline ? <p className="text-sm text-fr-muted">{detail.headline}</p> : null}
            {detail.shortBio ? <p className="text-sm leading-relaxed text-fr-primary">{detail.shortBio}</p> : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {detail.specialties.length > 0 ? (
                <div>
                  <dt className="text-fr-muted">Especialidades</dt>
                  <dd className="text-fr-primary">{detail.specialties.join(", ")}</dd>
                </div>
              ) : null}
              {detail.languages.length > 0 ? (
                <div>
                  <dt className="text-fr-muted">Idiomas</dt>
                  <dd className="text-fr-primary">{detail.languages.join(", ")}</dd>
                </div>
              ) : null}
              {detail.experienceYears != null ? (
                <div>
                  <dt className="text-fr-muted">Experiencia</dt>
                  <dd className="text-fr-primary">{detail.experienceYears} años</dd>
                </div>
              ) : null}
              {(detail.city || detail.region || detail.country) && (
                <div>
                  <dt className="text-fr-muted">Ubicación</dt>
                  <dd className="text-fr-primary">{[detail.city, detail.region, detail.country].filter(Boolean).join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="text-fr-muted">Disponibilidad</dt>
                <dd className="text-fr-primary">
                  {detail.isAvailableForJuryWork ? "Disponible" : "No disponible"}
                  {detail.availableRemote ? " · Remoto" : ""}
                  {detail.availableInPerson ? " · Presencial" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-fr-muted">Honorarios (vista pública)</dt>
                <dd className="text-fr-primary">{detail.pricingSummary ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-fr-muted">Concursos completados</dt>
                <dd className="text-fr-primary">{detail.completedAssignments}</dd>
              </div>
              {detail.responseRate != null ? (
                <div>
                  <dt className="text-fr-muted">Tasa de respuesta</dt>
                  <dd className="text-fr-primary">{Math.round(detail.responseRate)}%</dd>
                </div>
              ) : null}
              {detail.avgResponseTimeHours != null ? (
                <div>
                  <dt className="text-fr-muted">Tiempo medio de respuesta</dt>
                  <dd className="text-fr-primary">{detail.avgResponseTimeHours.toFixed(1)} h</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-fr-muted">
              Perfil público (participantes):{" "}
              <Link className="text-gold underline" href={`/jurados/publico/${detail.publicSlug}`} target="_blank" rel="noreferrer">
                /jurados/publico/{detail.publicSlug}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <OrganizerJudgeDetailInvite judgeAccountId={detail.judgeAccountId} contests={contests} />
    </div>
  );
}
