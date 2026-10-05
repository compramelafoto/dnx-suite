import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type { ClickatonerCard } from "@/lib/clickatoner/repository";
import { clickatonerWeekLabel } from "@/lib/clickatoner/week";
import { toInitials } from "@/lib/testimonials/public/voices-presentation";

/**
 * "Clickatoner de la semana" en la portada.
 *
 * Sin clickatoner no se dibuja nada: la sección aparece recién cuando hay una edición con
 * resultados publicados y alguien para mostrar.
 */
export function ClickatonerOfTheWeek({ clickatoner }: { clickatoner: ClickatonerCard | null }) {
  if (!clickatoner) return null;
  const c = clickatoner;

  return (
    <Section id="clickatoner" tone="raised" aria-labelledby="clickatoner-title">
      <Container>
        <SectionHeader
          eyebrow={`Semana ${clickatonerWeekLabel(c.weekStart)}`}
          title="Clickatoner de la semana"
          description="Cada viernes presentamos a alguien que corrió una maratón con nosotros. Conocé su trabajo."
          titleId="clickatoner-title"
        />
        <div className="mt-[var(--ck-stack-subtitle-to-content)]">
          <Card variant="yellow" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                {c.photoUrl ? (
                  <Image
                    src={c.photoUrl}
                    alt=""
                    width={88}
                    height={88}
                    className="h-22 w-22 shrink-0 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-22 w-22 shrink-0 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-ck-text-secondary"
                  >
                    {toInitials(c.fullName)}
                  </span>
                )}
                <div className="flex flex-col gap-1">
                  <p className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">{c.fullName}</p>
                  {c.place ? <p className="ck-body-md text-ck-text-secondary">{c.place}</p> : null}
                  {c.instagramHandle ? (
                    <a
                      href={`https://instagram.com/${c.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="ck-caption text-ck-yellow underline-offset-4 hover:underline"
                    >
                      @{c.instagramHandle}
                    </a>
                  ) : null}
                </div>
              </div>
              {c.work ? (
                <div className="flex flex-wrap items-center gap-2">
                  {c.work.premioLabel ? <Badge variant="accent">{c.work.premioLabel}</Badge> : null}
                  <p className="ck-caption text-ck-text-muted">
                    {[c.work.promptTitle ? `Consigna «${c.work.promptTitle}»` : null, c.work.editionName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
              {c.profilePath ? (
                <div>
                  <Button href={c.profilePath} variant="secondary" size="sm">
                    Ver el perfil de {c.firstName}
                  </Button>
                </div>
              ) : null}
            </div>
            {c.work ? (
              <figure className="overflow-hidden rounded-[var(--ck-radius-lg,1rem)] border border-ck-border">
                <Image
                  src={c.work.imageUrl}
                  alt={`Foto de ${c.fullName}${c.work.promptTitle ? ` para la consigna «${c.work.promptTitle}»` : ""}`}
                  width={1280}
                  height={960}
                  className="h-auto w-full object-cover"
                  unoptimized
                />
              </figure>
            ) : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}
