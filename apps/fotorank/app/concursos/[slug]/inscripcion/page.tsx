import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../lib/auth";
import {
  getCurrentPublishedRules,
  getMyContestRegistration,
} from "../../../lib/fotorank/registration";
import { InscriptionForm } from "./InscriptionForm";
import { EntryUploadPanel } from "./EntryUploadPanel";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const contest = await prisma.fotorankContest.findFirst({
    where: { slug, visibility: { in: ["PUBLIC", "UNLISTED"] } },
    select: { title: true },
  });
  return { title: contest ? `Inscripción · ${contest.title}` : "Inscripción | FotoRank" };
}

export default async function ContestInscriptionPage({ params }: Props) {
  const { slug } = await params;
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      status: { in: ["PUBLISHED", "ACTIVE"] },
    },
    include: {
      categories: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true } },
    },
  });
  if (!contest) notFound();

  const loginNext = `/concursos/${slug}/inscripcion`;
  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }

  const existing = await getMyContestRegistration(contest.id, user.id);
  if (existing && existing.status !== "CANCELLED" && existing.status !== "DISQUALIFIED") {
    return (
      <main className="min-h-screen bg-fr-bg text-fr-primary">
        <div className="mx-auto max-w-2xl px-8 py-16 md:px-10">
          <p className="fr-eyebrow text-gold">Inscripción</p>
          <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight md:text-4xl">{contest.title}</h1>
          <div className="fr-recuadro mt-10 space-y-6 border border-fr-border bg-fr-card">
            <p className="text-lg text-fr-primary">Ya estás inscripto/a.</p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-fr-muted">Número</dt>
                <dd className="mt-2 text-xl font-semibold text-gold" data-testid="registration-number">
                  {existing.registrationNumber}
                </dd>
              </div>
              <div>
                <dt className="text-fr-muted">Categoría</dt>
                <dd className="mt-2 text-fr-primary">{existing.categoryName}</dd>
              </div>
              <div>
                <dt className="text-fr-muted">Estado</dt>
                <dd className="mt-2 text-fr-primary">{existing.status}</dd>
              </div>
            </dl>
            <Link href="/participaciones" className="fr-btn fr-btn-primary inline-flex w-fit px-6 py-3">
              Ver mis participaciones
            </Link>
          </div>
          {existing.status === "CONFIRMED" ? (
            <EntryUploadPanel contestId={contest.id} contestSlug={slug} />
          ) : null}
        </div>
      </main>
    );
  }

  const rules = await getCurrentPublishedRules(contest.id);
  const isFree = contest.registrationPricingMode === "FREE";

  return (
    <main className="min-h-screen bg-fr-bg text-fr-primary">
      <div className="mx-auto max-w-2xl px-8 py-16 md:px-10">
        <p className="fr-eyebrow text-gold">Inscripción · {contest.organization.name}</p>
        <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight md:text-4xl">{contest.title}</h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-fr-muted">
          {isFree
            ? "Concurso gratuito: al confirmar quedarás inscripto/a sin cobro ni redirección a pagos."
            : "Concurso con inscripción paga: el cobro se completará vía DNX Payments (en preparación)."}
        </p>

        {!rules ? (
          <div className="fr-recuadro mt-10 border border-amber-500/40 bg-amber-500/10">
            <p className="fr-body text-fr-primary">
              Todavía no hay bases publicadas. El organizador debe publicar una versión antes de abrir
              inscripciones.
            </p>
            <Link href={`/concursos/${slug}`} className="fr-btn fr-btn-secondary mt-8 inline-flex w-fit">
              Volver al concurso
            </Link>
          </div>
        ) : (
          <InscriptionForm
            contestId={contest.id}
            contestSlug={slug}
            categories={contest.categories.map((c) => ({
              id: c.id,
              name: c.name,
              maxFiles: c.maxFiles,
            }))}
            rules={{
              id: rules.id,
              versionNumber: rules.versionNumber,
              title: rules.title,
              content: rules.content,
            }}
            isFree={isFree}
          />
        )}
      </div>
    </main>
  );
}
