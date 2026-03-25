"use client";

import Link from "next/link";
import { Icon } from "@repo/design-system";
import { ContestStatusBadge } from "./ContestStatusBadge";
import { ContestStatusSelector } from "./ContestStatusSelector";
import { DeleteContestButton } from "./DeleteContestButton";
import { routes } from "../../../lib/routes";

type Contest = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  visibility: string;
  organization: { name: string };
  status: string;
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

interface ContestHeaderProps {
  contest: Contest;
}

export function ContestHeader({ contest }: ContestHeaderProps) {
  const publicLive =
    contest.visibility === "PUBLIC" && (contest.status === "PUBLISHED" || contest.status === "ACTIVE");

  const dates = [
    contest.startAt && { label: "Inicio", value: formatDate(contest.startAt) },
    contest.submissionDeadline && {
      label: "Cierre inscripciones",
      value: formatDate(contest.submissionDeadline),
    },
    contest.judgingStartAt && {
      label: "Evaluación",
      value: formatDate(contest.judgingStartAt),
    },
    contest.resultsAt && {
      label: "Resultados",
      value: formatDate(contest.resultsAt),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <header className="fr-recuadro rounded-xl border border-[#262626] bg-[#141414]">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-6">
          <Link
            href={routes.concursos.index()}
            className="inline-flex items-center gap-2 text-sm text-fr-muted transition-colors hover:text-gold"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a concursos
          </Link>

          <div className="space-y-3">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl">
              {contest.title}
            </h1>
            {contest.shortDescription && (
              <p className="max-w-2xl text-sm leading-relaxed text-fr-muted">
                {contest.shortDescription}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ContestStatusBadge status={contest.status} />
            <span className="text-sm text-fr-muted">{contest.organization.name}</span>
          </div>

          {dates.length > 0 && (
            <dl className="flex max-w-xl flex-col gap-2">
              {dates.map((d) => (
                <div
                  key={d.label}
                  className="flex items-baseline justify-between gap-4 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <dt className="text-sm text-fr-muted-soft">{d.label}</dt>
                  <dd className="text-sm font-semibold text-fr-primary">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap gap-4">
          <Link
            href={routes.dashboard.concursos.resultados(contest.id)}
            className="fr-btn fr-btn-secondary px-3"
            aria-label="Resultados y ranking"
            title="Resultados"
          >
            <Icon name="sort" size="sm" />
          </Link>

          <Link
            href={routes.dashboard.concursos.editar(contest.id)}
            className="fr-btn fr-btn-secondary px-3"
            aria-label="Editar concurso"
            title="Editar"
          >
            <Icon name="edit" size="sm" />
          </Link>

          <DeleteContestButton
            contestId={contest.id}
            contestTitle={contest.title}
            iconOnly
            className="px-3"
          />

          {publicLive ? (
            <Link
              href={routes.concursos.publico(contest.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="fr-btn fr-btn-secondary px-3"
              aria-label="Landing pública del concurso"
              title="Landing pública"
            >
              <Icon name="eye" size="sm" />
            </Link>
          ) : (
            <button
              type="button"
              className="fr-btn fr-btn-secondary px-3 opacity-50"
              aria-label="Vista previa (publicá el concurso para habilitar la landing)"
              title="Publicá el concurso para ver la landing"
              disabled
            >
              <Icon name="eye" size="sm" />
            </button>
          )}

          <ContestStatusSelector contestId={contest.id} currentDbStatus={contest.status} />
        </div>
      </div>
    </header>
  );
}
