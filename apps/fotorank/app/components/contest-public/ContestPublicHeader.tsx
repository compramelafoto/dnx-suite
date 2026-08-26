import Image from "next/image";
import Link from "next/link";

type Props = {
  contestTitle: string;
  contestSlug: string;
  inscriptionHref: string;
  ctaEnabled: boolean;
  ctaLabel: string;
};

/**
 * Encabezado público compacto: no compite con el hero.
 */
export function ContestPublicHeader({
  contestTitle,
  contestSlug,
  inscriptionHref,
  ctaEnabled,
  ctaLabel,
}: Props) {
  return (
    <header className="fr-contest-topbar">
      <div className="fr-contest-container fr-contest-topbar__inner">
        <div className="fr-contest-topbar__brand">
          <Link href="/" className="fr-contest-topbar__logo" aria-label="FotoRank">
            <Image
              src="/fotorank-logo.png"
              alt="FotoRank"
              width={120}
              height={36}
              className="h-7 w-auto md:h-8"
              priority
            />
          </Link>
          <span className="fr-contest-topbar__divider" aria-hidden />
          <Link
            href={`/concursos/${contestSlug}`}
            className="fr-contest-topbar__contest"
            title={contestTitle}
          >
            {contestTitle}
          </Link>
        </div>
        <div className="fr-contest-topbar__actions">
          {ctaEnabled ? (
            <Link href={inscriptionHref} className="fr-btn fr-btn-primary fr-contest-topbar__cta">
              {ctaLabel}
            </Link>
          ) : (
            <span className="fr-btn fr-btn-secondary fr-contest-topbar__cta" aria-disabled="true">
              {ctaLabel}
            </span>
          )}
          <Link href="/login" className="fr-contest-topbar__account fr-type-caption">
            Cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
