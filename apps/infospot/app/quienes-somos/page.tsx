import type { Metadata } from "next";
import Link from "next/link";
import { EditorialContainer, Section } from "@/components/foundations";
import {
  getInfoSpotSettings,
  mailtoEditorial,
  mailtoPress,
} from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Quiénes somos",
    description:
      "Info Spot es un medio digital argentino dedicado a la difusión y cobertura de eventos deportivos, culturales y sociales.",
    alternates: { canonical: "/quienes-somos" },
  };
}

export default async function QuienesSomosPage() {
  const settings = await getInfoSpotSettings();
  const press = mailtoPress(settings, "Consulta de prensa — Info Spot");
  const editorial = mailtoEditorial(settings, "Consulta editorial — Info Spot");
  const paragraphs = (settings.institutionalText || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <Section spacing="lg">
        <EditorialContainer className="max-w-3xl">
          <p className="is-eyebrow">Institucional</p>
          <h1 className="is-h1 mt-3 text-4xl md:text-5xl">Quiénes somos</h1>
          <div className="mt-6 space-y-4">
            {paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="is-body text-base md:text-lg">
                {p}
              </p>
            ))}
          </div>
        </EditorialContainer>
      </Section>

      <Section tone="muted" spacing="lg">
        <EditorialContainer>
          <h2 className="is-h2 text-2xl md:text-3xl">Para quién trabajamos</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <article className="border-t border-[var(--is-border)] pt-5">
              <h3 className="text-lg font-semibold">Organizadores</h3>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                Publicá tu evento gratuitamente, ganá difusión editorial y, próximamente,
                conectá con fotógrafos e inscripciones.
              </p>
              <Link href="/publicar-evento" className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                Publicar mi evento
              </Link>
            </article>
            <article className="border-t border-[var(--is-border)] pt-5">
              <h3 className="text-lg font-semibold">Fotógrafos</h3>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                Formamos una red de cobertura deportiva, cultural y social en distintas
                localidades, con vínculo al ecosistema ComprameLaFoto.
              </p>
              <Link href="/colaboradores" className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                Cómo colaborar
              </Link>
            </article>
            <article className="border-t border-[var(--is-border)] pt-5">
              <h3 className="text-lg font-semibold">Prensa y medios</h3>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                Comunicados, agenda y consultas institucionales. Respondemos desde el canal
                de prensa configurado por la dirección.
              </p>
              {press ? (
                <a href={press} className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                  Escribir a prensa
                </a>
              ) : (
                <Link href="/contacto" className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                  Contacto
                </Link>
              )}
            </article>
            <article className="border-t border-[var(--is-border)] pt-5">
              <h3 className="text-lg font-semibold">Contacto editorial</h3>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                Correcciones, propuestas de cobertura y consultas de la redacción.
              </p>
              {editorial ? (
                <a href={editorial} className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                  Escribir a redacción
                </a>
              ) : (
                <Link href="/contacto" className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline">
                  Ir a contacto
                </Link>
              )}
            </article>
          </div>
        </EditorialContainer>
      </Section>
    </>
  );
}
