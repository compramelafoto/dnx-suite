/**
 * Preview administrativo de un concurso próximo.
 *
 * Permite revisar, antes de publicar: la tarjeta futura en desktop y mobile, la
 * landing "Próximamente", el modal de "Notificarme", los precios por etapa, la
 * consigna, los premios, el cronograma, las bases, las plantillas de email, los
 * campos incompletos y los bloqueos de publicación.
 *
 * Nada de lo que se ve acá está publicado: el concurso sigue en su fase real.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";

import { PageContainer } from "../../../../../components/PageContainer";
import { routes } from "../../../../../lib/routes";
import { UpcomingContestCard } from "../../../../../components/contest-upcoming/UpcomingContestCard";
import { UpcomingContestLanding } from "../../../../../components/contest-upcoming/UpcomingContestLanding";
import { requireAdminContestScope } from "../../../../../lib/fotorank/upcoming/admin-access";
import {
  buildGateSnapshot,
  getAdminContestCardPreview,
  loadPricePhases,
  parseUpcomingConfig,
} from "../../../../../lib/fotorank/upcoming/service";
import {
  evaluateRegistrationOpenGate,
  evaluateUpcomingGate,
  listMissingPrizeFields,
} from "../../../../../lib/fotorank/upcoming/publication-gates";
import { formatMinorAmount } from "../../../../../lib/fotorank/upcoming/pricing";
import {
  CONTEST_LIFECYCLE_LABELS,
  CONTEST_LIFECYCLE_PHASES,
  canTransition,
  type ContestLifecyclePhase,
} from "../../../../../lib/fotorank/upcoming/lifecycle";
import {
  CONSENT_TEXTS,
  INTEREST_MODAL_COPY,
  renderConsentText,
  renderModalTitle,
} from "../../../../../lib/fotorank/upcoming/consent";
import { COMMUNICATION_EVENTS } from "../../../../../lib/fotorank/upcoming/communications";
import { PhaseTransitionPanel } from "./PhaseTransitionPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const TZ = "America/Argentina/Buenos_Aires";

function fmt(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("es-AR", { timeZone: TZ });
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="fr-recuadro space-y-4 border border-fr-border bg-fr-card p-6">
      <h2 className="font-sans text-lg font-semibold text-fr-primary">{title}</h2>
      {children}
    </section>
  );
}

function GateList({ report }: { report: ReturnType<typeof evaluateUpcomingGate> }) {
  return (
    <ul className="space-y-2 text-sm">
      {report.requirements.map((r) => (
        <li key={r.key} className="flex flex-wrap items-baseline gap-2">
          <span className={r.satisfied ? "text-gold" : "text-[#e07a7a]"}>
            {r.satisfied ? "✓" : "✗"}
          </span>
          <span className={r.satisfied ? "text-fr-primary" : "text-[#e07a7a]"}>{r.label}</span>
          {r.hint && !r.satisfied ? (
            <span className="text-xs text-fr-muted">— {r.hint}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function ContestProximamentePage({ params }: PageProps) {
  const { id } = await params;
  const scope = await requireAdminContestScope(id);
  if (!scope.ok) notFound();

  const [contest, card, snapshot, phases] = await Promise.all([
    prisma.fotorankContest.findUnique({
      where: { id: scope.scope.contestId },
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        slug: true,
        timezone: true,
        rulesData: true,
        registrationOpensAt: true,
        submissionDeadline: true,
        judgingStartAt: true,
        judgingEndAt: true,
        resultsAt: true,
        rulesVersions: {
          select: { id: true, versionNumber: true, status: true, title: true, content: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
        scheduledCommunications: { orderBy: [{ scheduledAt: "asc" }, { code: "asc" }] },
      },
    }),
    getAdminContestCardPreview({
      contestId: scope.scope.contestId,
      organizationId: scope.scope.organizationId,
    }),
    buildGateSnapshot({
      contestId: scope.scope.contestId,
      organizationId: scope.scope.organizationId,
    }),
    loadPricePhases(scope.scope.contestId),
  ]);

  if (!contest || !card || !snapshot) notFound();

  const config = parseUpcomingConfig(contest.rulesData);
  const upcomingGate = evaluateUpcomingGate(snapshot);
  const openGate = evaluateRegistrationOpenGate(snapshot);
  const missingPrize = listMissingPrizeFields(snapshot.prize);
  const rulesVersion = contest.rulesVersions[0] ?? null;

  // Fases alcanzables desde el estado actual, según el ciclo de vida.
  const availableTargets = CONTEST_LIFECYCLE_PHASES.filter(
    (phase): phase is ContestLifecyclePhase => canTransition(contest.status, phase).allowed,
  );

  return (
    <PageContainer
      title={`Vista previa: ${contest.title}`}
      description="Revisión previa a la publicación. Nada de lo que se ve acá está publicado."
    >
      <div className="space-y-8">
        <div className="fr-recuadro border border-[#7a2e2e] bg-[#1a0d0d] p-5">
          <p className="text-sm text-[#e6b8b8]">
            Estado real del concurso:{" "}
            <strong className="text-white">
              {CONTEST_LIFECYCLE_LABELS[
                contest.status as keyof typeof CONTEST_LIFECYCLE_LABELS
              ] ?? contest.status}
            </strong>{" "}
            · Visibilidad: <strong className="text-white">{contest.visibility}</strong>
          </p>
          {contest.status === "DRAFT" ? (
            <p className="mt-2 text-xs text-[#c99]">
              En borrador el concurso no aparece públicamente, no acepta pagos ni fotografías y no
              envía correos reales.
            </p>
          ) : null}
          {(config.adminFlags ?? []).length > 0 ? (
            <ul className="mt-3 space-y-1">
              {(config.adminFlags ?? []).map((flag) => (
                <li key={flag} className="text-xs font-semibold uppercase tracking-wider text-[#e6b8b8]">
                  ⚠ {flag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Panel title="Cambio de fase">
          <PhaseTransitionPanel
            contestId={id}
            currentStatus={contest.status}
            targets={availableTargets}
          />
        </Panel>

        <Panel title="Bloqueos para pasar a PRÓXIMAMENTE">
          <p className="text-sm text-fr-muted">
            {upcomingGate.passed
              ? "Todos los requisitos están completos."
              : `Faltan ${upcomingGate.missing.length} requisito(s).`}
          </p>
          <GateList report={upcomingGate} />
        </Panel>

        <Panel title="Bloqueos para abrir inscripciones">
          <p className="text-sm text-fr-muted">
            {openGate.passed
              ? "Todos los requisitos están completos."
              : `Faltan ${openGate.missing.length} requisito(s).`}
          </p>
          <GateList report={openGate} />
        </Panel>

        <Panel title="Tarjeta futura — desktop">
          <UpcomingContestCard card={card} interest={null} previewMode variant="desktop" />
        </Panel>

        <Panel title="Tarjeta futura — mobile">
          <UpcomingContestCard card={card} interest={null} previewMode variant="mobile" />
        </Panel>

        <Panel title="Modal de “Notificarme”">
          <div className="space-y-4 border border-fr-border bg-[#0d0d0d] p-6">
            <h3 className="font-sans text-lg font-semibold text-fr-primary">
              {renderModalTitle(contest.title)}
            </h3>
            <p className="text-sm text-fr-muted">{INTEREST_MODAL_COPY.body}</p>
            <p className="text-xs text-[#8a8a8a]">
              {renderConsentText("CONTEST_SPECIFIC", contest.title)}
            </p>
            <p className="text-xs text-[#8a8a8a]">
              ☐ {CONSENT_TEXTS.GENERAL.template}{" "}
              <span className="text-[#6b6b6b]">(opcional, nunca premarcada)</span>
            </p>
            <p className="text-xs text-gold">Botón: {INTEREST_MODAL_COPY.confirmLabel}</p>
            <div className="border-t border-fr-border pt-4">
              <p className="text-xs uppercase tracking-wider text-fr-muted">Confirmación exitosa</p>
              <p className="mt-2 text-sm text-fr-primary">{INTEREST_MODAL_COPY.successMessage}</p>
            </div>
            <p className="text-xs text-fr-muted">
              Versión de consentimiento: {CONSENT_TEXTS.CONTEST_SPECIFIC.version}
            </p>
          </div>
        </Panel>

        <Panel title="Landing “Próximamente”">
          <div className="overflow-hidden border border-fr-border">
            <UpcomingContestLanding
              card={card}
              interest={null}
              brief={config.brief ?? null}
              previewMode
            />
          </div>
        </Panel>

        <Panel title="Precios y etapas">
          {phases.length === 0 ? (
            <p className="text-sm text-fr-muted">Sin etapas de precio configuradas.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-fr-muted">
                Configuración administrativa. Los precios sólo se muestran públicamente cuando el
                concurso abre inscripciones, y el importe siempre lo calcula el servidor.
              </p>
              {phases.map((p) => (
                <div key={p.code} className="border border-fr-border p-4">
                  <p className="font-semibold text-fr-primary">{p.name}</p>
                  <p className="text-xs text-fr-muted">
                    {p.audience === "INTEREST_EXCLUSIVE"
                      ? "Exclusivo para interesados"
                      : "Público general"}{" "}
                    · {fmt(p.startsAt)} → {fmt(p.endsAt)}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-fr-primary">
                    {p.tiers.map((t) => (
                      <li key={t.quantity}>
                        {t.quantity} fotografía{t.quantity === 1 ? "" : "s"}:{" "}
                        {formatMinorAmount(t.amountMinor, p.currency)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Consigna">
          {config.brief ? (
            <>
              <p className="font-semibold text-fr-primary">{config.brief.title}</p>
              {config.brief.text.split("\n\n").map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-fr-muted">
                  {p}
                </p>
              ))}
            </>
          ) : (
            <p className="text-sm text-fr-muted">Sin consigna cargada.</p>
          )}
        </Panel>

        <Panel title="Premios">
          <p className="text-sm text-fr-muted">
            {config.prize?.provisionalDescription ?? "Sin descripción provisional."}
          </p>
          {missingPrize.length > 0 ? (
            <div className="border border-[#7a2e2e] bg-[#1a0d0d] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#e6b8b8]">
                Campos del premio pendientes
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[#e6b8b8]">
                {missingPrize.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gold">Premio confirmado.</p>
          )}
        </Panel>

        <Panel title="Jurado y criterios de evaluación">
          <p className="text-sm text-fr-muted">
            {snapshot.judgesConfirmed ? "Jurados confirmados." : "JURADOS PENDIENTES DE CONFIRMACIÓN"}
          </p>
          <ul className="space-y-1 text-sm text-fr-primary">
            {(config.juryPositions ?? []).map((j) => (
              <li key={j.code}>
                {j.label}: {j.profile} {j.confirmed ? "" : "— pendiente"}
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-sm text-fr-primary">
            {(config.evaluationCriteria ?? []).map((c) => (
              <li key={c.code}>
                {c.label}: {c.weightPercent}%
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Cronograma">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            {[
              ["Cierre de captación con beneficio", snapshot.interestBenefitCutoffAt],
              ["Apertura de inscripciones", contest.registrationOpensAt],
              ["Fin del precio promocional", snapshot.benefitDeadlineAt],
              ["Cierre de inscripción y carga", contest.submissionDeadline],
              ["Inicio de evaluación", contest.judgingStartAt],
              ["Fin de evaluación", contest.judgingEndAt],
              ["Resultados", contest.resultsAt],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs uppercase tracking-wider text-fr-muted">{String(label)}</dt>
                <dd className="text-fr-primary">{fmt(value as Date | null)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-fr-muted">Huso horario: {contest.timezone ?? "no configurado"}</p>
        </Panel>

        <Panel title="Bases">
          {rulesVersion ? (
            <>
              <p className="text-sm text-fr-muted">
                Versión {rulesVersion.versionNumber} · Estado: {rulesVersion.status}
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap border border-fr-border bg-[#0d0d0d] p-4 text-xs text-fr-muted">
                {rulesVersion.content}
              </pre>
            </>
          ) : (
            <p className="text-sm text-fr-muted">Sin versión de bases cargada.</p>
          )}
        </Panel>

        <Panel title="Plantillas de email programadas">
          {contest.scheduledCommunications.length === 0 ? (
            <p className="text-sm text-fr-muted">Sin comunicaciones programadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="border-b border-fr-border text-xs uppercase tracking-wider text-fr-muted">
                  <tr>
                    <th className="py-2 pr-4">Fecha (AR)</th>
                    <th className="py-2 pr-4">Asunto</th>
                    <th className="py-2 pr-4">Evento</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Audiencia</th>
                    <th className="py-2 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="text-fr-primary">
                  {contest.scheduledCommunications.map((c) => (
                    <tr key={c.id} className="border-b border-fr-border/40">
                      <td className="py-2 pr-4">
                        {c.isDateDriven ? (c.scheduledLocal ?? fmt(c.scheduledAt)) : "Por evento"}
                      </td>
                      <td className="py-2 pr-4">{c.subject}</td>
                      <td className="py-2 pr-4">
                        {COMMUNICATION_EVENTS[
                          c.eventType as keyof typeof COMMUNICATION_EVENTS
                        ]?.label ?? c.eventType}
                      </td>
                      <td className="py-2 pr-4">
                        {c.category === "OPERATIONAL" ? "Operativa" : "Promocional"}
                      </td>
                      <td className="py-2 pr-4">{c.audience}</td>
                      <td className="py-2 pr-4">
                        {c.blockedReason ? (
                          <span className="text-[#e07a7a]">{c.blockedReason}</span>
                        ) : contest.status === "DRAFT" ? (
                          <span className="text-fr-muted">
                            Bloqueada: el concurso está en borrador
                          </span>
                        ) : (
                          <span className="text-gold">Programada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-wrap gap-3">
          <Link
            href={routes.dashboard.concursos.interesados(id)}
            className="fr-btn fr-btn-secondary inline-flex w-fit"
          >
            Ver interesados
          </Link>
          <Link
            href={routes.dashboard.concursos.detalle(id)}
            className="fr-btn fr-btn-secondary inline-flex w-fit"
          >
            Volver al concurso
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
