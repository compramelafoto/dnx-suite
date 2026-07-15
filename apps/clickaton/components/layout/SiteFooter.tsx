import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Divider } from "@/components/ui/Divider";
import { footerNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ck-border bg-ck-bg-alt text-ck-text">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Wordmark tone="inverse" href="/" height={48} className="h-12 w-auto max-w-[14rem]" />
          <p className="ck-body-sm max-w-md text-ck-text-secondary">{siteConfig.descriptor}</p>
          <p className="ck-body-sm max-w-md text-ck-text-muted">
            Proyecto en desarrollo. Arquitectura pública de lanzamiento — sin inscripciones,
            catálogo ni formularios activos todavía.
          </p>
          <p className="ck-body-sm max-w-md text-ck-yellow/85">{siteConfig.promise}</p>
        </div>

        <nav aria-label="Pie de página">
          <p className="ck-overline text-ck-yellow">Navegación</p>
          <ul className="mt-[var(--ck-stack-title-to-subtitle)] space-y-3">
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="ck-body-sm text-ck-text-secondary underline-offset-4 transition-colors duration-[var(--ck-duration-base)] hover:text-ck-yellow hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <Divider className="border-ck-border" />
      <Container className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="ck-caption text-ck-text-muted">
          © {year} {siteConfig.copyrightOwner}. Todos los derechos reservados.
        </p>
        <p className="ck-caption text-ck-text-muted">
          Identidad visual — Design System V2
        </p>
      </Container>
    </footer>
  );
}
