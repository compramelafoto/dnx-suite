import Link from "next/link";
import { SiteContainer } from "@/components/foundations";

type Props = {
  slogan?: string;
  links: Array<{ href: string; label: string }>;
};

/** Franja editorial de actualidad — no ticker agresivo. */
export function HomeActualidadStrip({
  slogan = "Descubrí lo que está pasando cerca tuyo.",
  links,
}: Props) {
  return (
    <div className="border-b border-[var(--is-border)] bg-[var(--is-bg)]">
      <SiteContainer className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-8 md:py-3.5">
        <p className="is-body-sm max-w-xl text-[var(--is-text-secondary)]">
          <span className="is-label mr-3 align-middle">Ahora</span>
          {slogan}
        </p>
        {links.length > 0 ? (
          <nav
            aria-label="Accesos de actualidad"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {links.slice(0, 5).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--is-text)] transition-colors hover:text-[var(--is-accent)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </SiteContainer>
    </div>
  );
}
