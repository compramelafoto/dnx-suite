import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { loadClickatonerProfile } from "@/lib/clickatoner/repository";
import { toInitials } from "@/lib/testimonials/public/voices-presentation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const perfil = await loadClickatonerProfile(slug).catch(() => null);
  if (!perfil) return { title: "Clickatoner", robots: { index: false } };
  return {
    title: `${perfil.fullName} · Clickatoner`,
    description: `Las fotos de ${perfil.fullName} en las maratones de Clickatón.`,
  };
}

/**
 * La página pública de un clickatoner: quién es y sus obras de las maratones con resultados
 * publicados, con el premio si lo ganó.
 *
 * Nace la primera vez que la persona sale como Clickatoner de la semana. Si pide no aparecer, o
 * su edición despublica resultados, la página da 404 —el mismo 404 que si nunca hubiera existido—.
 */
export default async function ClickatonerProfilePage({ params }: Props) {
  const { slug } = await params;
  const perfil = await loadClickatonerProfile(slug);
  if (!perfil) notFound();

  return (
    <Section tone="base">
      <Container>
        <header className="flex flex-wrap items-center gap-5">
          {perfil.photoUrl ? (
            <Image
              src={perfil.photoUrl}
              alt=""
              width={112}
              height={112}
              className="h-28 w-28 shrink-0 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-xl text-ck-text-secondary"
            >
              {toInitials(perfil.fullName)}
            </span>
          )}
          <div className="flex flex-col gap-1">
            <p className="ck-caption uppercase tracking-wide text-ck-yellow">Clickatoner</p>
            <h1 className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text md:text-4xl">
              {perfil.fullName}
            </h1>
            {perfil.place ? <p className="ck-body-md text-ck-text-secondary">{perfil.place}</p> : null}
            {perfil.instagramHandle ? (
              <a
                href={`https://instagram.com/${perfil.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="ck-body-md text-ck-yellow underline-offset-4 hover:underline"
              >
                @{perfil.instagramHandle}
              </a>
            ) : null}
          </div>
        </header>

        <div className="mt-[var(--ck-stack-subtitle-to-content)] grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {perfil.works.map((obra) => (
            <Card key={obra.submissionId} as="figure" className="flex flex-col gap-3">
              <Image
                src={obra.imageUrl}
                alt={`Foto de ${perfil.fullName}${obra.promptTitle ? ` para la consigna «${obra.promptTitle}»` : ""}`}
                width={1280}
                height={960}
                className="h-auto w-full rounded-md object-cover"
                unoptimized
              />
              <figcaption className="flex flex-col gap-1">
                {obra.premioLabel ? (
                  <span>
                    <Badge variant="accent">{obra.premioLabel}</Badge>
                  </span>
                ) : null}
                {obra.promptTitle ? <span className="ck-body-md text-ck-text">«{obra.promptTitle}»</span> : null}
                <span className="ck-caption text-ck-text-muted">{obra.editionName}</span>
              </figcaption>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
