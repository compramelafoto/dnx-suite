import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Divider } from "@/components/ui/Divider";
import { footerNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ck-border bg-ck-black text-ck-white">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Wordmark tone="inverse" href="#inicio" />
          <p className="ck-body-sm max-w-md text-ck-gray-200">{siteConfig.descriptor}</p>
          <p className="ck-body-sm max-w-md text-ck-gray-500">
            Proyecto en desarrollo. Home pública de lanzamiento — sin inscripciones, catálogo
            ni formularios activos todavía.
          </p>
          <p className="ck-body-sm max-w-md text-ck-yellow/80">{siteConfig.promise}</p>
        </div>

        <nav aria-label="Pie de página">
          <p className="ck-label text-ck-yellow">Navegación</p>
          <ul className="mt-4 space-y-2">
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="ck-body-sm text-ck-gray-200 underline-offset-4 hover:text-ck-yellow hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <Divider className="border-white/10" />
      <Container className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="ck-caption text-ck-gray-500">
          © {year} {siteConfig.copyrightOwner}. Todos los derechos reservados.
        </p>
        <p className="ck-caption text-ck-gray-500">
          Wordmark tipográfico provisional — logo oficial pendiente.
        </p>
      </Container>
    </footer>
  );
}
