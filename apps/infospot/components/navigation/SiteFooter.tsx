import Link from "next/link";
import { SiteContainer } from "@/components/foundations";
import { BrandMark } from "@/components/brand/BrandMark";
import { primaryNavLinks } from "@/components/navigation/nav-links";
import { getInfoSpotSettings } from "@/lib/settings";

const categoryLinks = [
  { href: "/categorias/deportes", label: "Deportes" },
  { href: "/categorias/cultura", label: "Cultura" },
  { href: "/categorias/fotografia", label: "Fotografía" },
] as const;

const legalLinks = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
  { href: "/politica-editorial", label: "Política editorial" },
] as const;

export async function SiteFooter() {
  const settings = await getInfoSpotSettings();
  const year = new Date().getFullYear();
  const socials = [
    { href: settings.instagramUrl, label: "Instagram" },
    { href: settings.facebookUrl, label: "Facebook" },
    { href: settings.xUrl, label: "X" },
  ].filter((s): s is { href: string; label: string } => Boolean(s.href));

  return (
    <footer className="mt-auto border-t border-[var(--is-border)] bg-[var(--is-bg-secondary)]">
      <SiteContainer className="grid gap-10 py-12 md:grid-cols-2 md:gap-12 md:py-16 lg:grid-cols-4">
        <div className="max-w-sm space-y-4 lg:col-span-1">
          <BrandMark variant="horizontal" />
          <p className="is-body text-[0.95rem]">
            {settings.footerText ||
              "Medio digital argentino. Cobertura deportiva, cultural y social con mirada fotográfica."}
          </p>
        </div>

        <div>
          <p className="is-eyebrow mb-4">Navegación</p>
          <ul className="space-y-3 text-sm font-medium text-[var(--is-text-secondary)]">
            {primaryNavLinks.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link href={item.href} className="hover:text-[var(--is-accent)]">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/colaboradores" className="hover:text-[var(--is-accent)]">
                Colaboradores
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="is-eyebrow mb-4">Categorías</p>
          <ul className="space-y-3 text-sm font-medium text-[var(--is-text-secondary)]">
            {categoryLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-[var(--is-accent)]">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/noticias" className="hover:text-[var(--is-accent)]">
                Todas las noticias
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-8">
          <div>
            <p className="is-eyebrow mb-4">Prensa</p>
            <p className="is-body text-sm">
              Consultas editoriales
              {settings.pressEmail || settings.contactEmail
                ? ` · ${settings.pressEmail || settings.contactEmail}`
                : "."}
            </p>
            <Link
              href="/contacto"
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--is-accent)] hover:text-[var(--is-accent-hover)]"
            >
              Contacto de prensa
            </Link>
          </div>
          <div>
            <p className="is-eyebrow mb-4">Redes</p>
            {socials.length > 0 ? (
              <ul className="flex flex-wrap gap-3 text-sm font-medium text-[var(--is-text-secondary)]">
                {socials.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="inline-flex min-h-11 items-center rounded-[var(--is-radius-md)] border border-[var(--is-border)] px-3 hover:text-[var(--is-accent)]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--is-muted)]">Próximamente</p>
            )}
          </div>
        </div>
      </SiteContainer>

      <div className="border-t border-[var(--is-border)]">
        <SiteContainer className="flex flex-col gap-3 py-5 text-sm text-[var(--is-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.siteName}. Parte del ecosistema DNX Suite.
          </p>
          <ul className="flex flex-wrap gap-4">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-[var(--is-accent)]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </SiteContainer>
      </div>
    </footer>
  );
}
