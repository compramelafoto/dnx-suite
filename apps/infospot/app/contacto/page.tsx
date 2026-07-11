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
    title: "Contacto",
    description: "Contacto editorial, prensa, organizadores y colaboradores de Info Spot.",
    alternates: { canonical: "/contacto" },
  };
}

export default async function ContactoPage() {
  const settings = await getInfoSpotSettings();
  const editorial = mailtoEditorial(settings, "Consulta editorial — Info Spot");
  const press = mailtoPress(settings, "Consulta de prensa — Info Spot");

  const channels = [
    {
      title: "Redacción",
      body: "Consultas editoriales, correcciones y propuestas de cobertura.",
      href: editorial,
      label: settings.contactEmail || "Configurar email editorial en admin",
    },
    {
      title: "Prensa",
      body: "Comunicados, agenda institucional y consultas de medios.",
      href: press,
      label: settings.pressEmail || settings.contactEmail || "Configurar email de prensa en admin",
    },
    {
      title: "Organizadores",
      body: "Publicá tu evento para revisión editorial.",
      href: "/publicar-evento",
      label: "Ir a publicar evento",
      internal: true,
    },
    {
      title: "Fotógrafos y colaboradores",
      body: "Sumate a la red de cobertura de Info Spot.",
      href: "/colaboradores",
      label: "Ver colaboradores",
      internal: true,
    },
  ] as const;

  const socials = [
    { label: "Instagram", href: settings.instagramUrl },
    { label: "Facebook", href: settings.facebookUrl },
    { label: "X", href: settings.xUrl },
    { label: "WhatsApp", href: settings.whatsappUrl },
  ].filter((s) => Boolean(s.href));

  return (
    <Section spacing="lg">
      <EditorialContainer>
        <header className="max-w-2xl">
          <p className="is-eyebrow">Hablemos</p>
          <h1 className="is-h1 mt-3 text-4xl md:text-5xl">Contacto</h1>
          <p className="is-body mt-4">
            Elegí el canal que mejor se ajuste. No publicamos domicilios ni teléfonos
            inventados: usamos solo los datos configurados por la dirección del medio.
          </p>
        </header>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {channels.map((channel) => (
            <article
              key={channel.title}
              className="border border-[var(--is-border)] bg-[var(--is-surface)] p-6"
            >
              <h2 className="text-xl font-semibold">{channel.title}</h2>
              <p className="mt-3 text-sm text-[var(--is-text-secondary)]">{channel.body}</p>
              {channel.href ? (
                "internal" in channel && channel.internal ? (
                  <Link
                    href={channel.href}
                    className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--is-accent)] hover:underline"
                  >
                    {channel.label}
                  </Link>
                ) : (
                  <a
                    href={channel.href}
                    className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--is-accent)] hover:underline"
                  >
                    {channel.label}
                  </a>
                )
              ) : (
                <p className="mt-5 text-sm text-[var(--is-muted)]">{channel.label}</p>
              )}
            </article>
          ))}
        </div>

        <div className="mt-12 border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-6 md:p-10">
          <h2 className="text-xl font-semibold">Redes</h2>
          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href!}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="inline-flex min-h-11 items-center px-3 text-sm font-medium ring-1 ring-[var(--is-border)] hover:text-[var(--is-accent)]"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--is-muted)]">
              Las redes se mostrarán cuando la dirección las configure en el panel del medio.
            </p>
          )}
        </div>
      </EditorialContainer>
    </Section>
  );
}
