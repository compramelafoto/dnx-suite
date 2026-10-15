import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@repo/design-system";
import { PageContainer, PublicShell } from "../../../components/public-ui";
import { getJudgePublicProfile } from "../../../actions/judges";
import { JudgeBioRenderer } from "../../../components/judges/JudgeBioRenderer";
import {
  instagramProfileHref,
  safeJudgeBioForPublicRender,
  safeJudgeOtherLinksForPublicRender,
} from "../../../lib/fotorank/judges/judgePublicDisplay";

export default async function JudgePublicProfilePage({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = await params;
  const result = await getJudgePublicProfile(publicSlug);
  if (!result.ok || !result.data) return notFound();

  const data = result.data as {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    shortBio: string | null;
    fullBioRichJson: unknown;
    city: string | null;
    country: string | null;
    website: string | null;
    instagram: string | null;
    otherLinksJson: unknown;
    assignments: Array<{ contestId: string; contestTitle: string; categoryName: string; assignmentType: string }>;
    portfolio: Array<{ id: string; src: string; title: string | null }>;
  };

  const bioDoc = safeJudgeBioForPublicRender(data.fullBioRichJson);
  const extraLinks = safeJudgeOtherLinksForPublicRender(data.otherLinksJson);
  const location = [data.city, data.country].filter(Boolean).join(", ");
  const igHref = instagramProfileHref(data.instagram);

  return (
    <PublicShell header={{ variant: "contest", panelHref: "/jurado/panel" }}>
      <section className="fr-public-section">
        <PageContainer className="max-w-3xl space-y-6">
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="shrink-0">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={`${data.firstName} ${data.lastName}`}
                  className="h-28 w-28 rounded-full border border-zinc-700 object-cover sm:h-32 sm:w-32"
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-zinc-600 text-sm text-fr-muted sm:h-32 sm:w-32"
                  aria-hidden
                >
                  Sin foto
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-3xl font-semibold text-fr-primary">
                {data.firstName} {data.lastName}
              </h1>
              {location ? <p className="text-sm text-fr-muted">{location}</p> : null}
              {data.shortBio ? <p className="text-base leading-relaxed text-fr-muted">{data.shortBio}</p> : null}

              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                {data.website ? (
                  <a
                    href={data.website}
                    className="text-sm font-medium text-fr-primary underline decoration-fr-primary/40 underline-offset-2 hover:decoration-fr-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sitio web
                  </a>
                ) : null}
                {data.instagram && igHref ? (
                  <a
                    href={igHref}
                    className="text-sm font-medium text-fr-primary underline decoration-fr-primary/40 underline-offset-2 hover:decoration-fr-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                ) : null}
                {extraLinks.links.map((l) => (
                  <a
                    key={l.url + l.label}
                    href={l.url}
                    className="text-sm font-medium text-fr-primary underline decoration-fr-primary/40 underline-offset-2 hover:decoration-fr-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label || l.url}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {bioDoc.blocks.length > 0 ? (
          <Card>
            <h2 className="text-xl font-semibold text-fr-primary">Sobre el jurado</h2>
            <div className="mt-4">
              <JudgeBioRenderer doc={bioDoc} />
            </div>
          </Card>
        ) : null}

        {data.portfolio.length > 0 ? (
          <Card>
            <h2 className="text-xl font-semibold text-fr-primary">Su trabajo</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.portfolio.map((img) => (
                <li key={img.id}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.title ?? ""}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded border border-zinc-700 object-cover"
                    />
                    {img.title ? (
                      <figcaption className="mt-2 text-xs text-fr-muted">{img.title}</figcaption>
                    ) : null}
                  </figure>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-xl font-semibold text-fr-primary">Participaciones</h2>
          <ul className="mt-3 space-y-2 text-sm text-fr-muted">
            {data.assignments.map((a, i) => (
              <li key={`${a.contestId}-${a.categoryName}-${i}`}>
                <span className="text-fr-primary/90">{a.contestTitle}</span>
                <span className="text-fr-muted"> · {a.categoryName}</span>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-center text-xs text-fr-muted-soft">
          <Link href="/jurados/galeria" className="underline underline-offset-2 hover:text-fr-muted">
            Ver todos los jurados
          </Link>
          {" · "}
          <Link href="/jurados/postulacion" className="underline underline-offset-2 hover:text-fr-muted">
            ¿Sos fotógrafo? Postulate como jurado
          </Link>
        </p>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
