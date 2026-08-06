import Image from "next/image";
import Link from "next/link";

type Props = {
  organizationName?: string | null;
  supportEmail?: string | null;
};

export function PublicFooter({ organizationName, supportEmail }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]" data-testid="public-footer">
      <div className="fr-public-container grid gap-10 py-12 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Link href="/" aria-label="FotoRank" className="inline-flex">
            <Image
              src="/fotorank-logo.png"
              alt="FotoRank"
              width={220}
              height={72}
              className="h-14 w-auto max-w-[12rem] object-contain opacity-90 md:h-16 md:max-w-[14rem]"
            />
          </Link>
          <p className="fr-public-body max-w-md text-sm">
            Plataforma profesional para concursos fotográficos. Participá con claridad, confianza y
            calidad editorial.
          </p>
          {organizationName ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              Concurso organizado por{" "}
              <strong className="font-semibold text-[var(--foreground)]">{organizationName}</strong>.
            </p>
          ) : null}
        </div>
        <nav aria-label="Pie de página">
          <p className="fr-public-eyebrow">Enlaces</p>
          <ul className="mt-4 space-y-3 text-sm text-[var(--foreground-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--primary)]">
                Inicio
              </Link>
            </li>
            <li>
              <Link href="/participaciones" className="hover:text-[var(--primary)]">
                Mis participaciones
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-[var(--primary)]">
                Iniciar sesión
              </Link>
            </li>
            {supportEmail ? (
              <li>
                <a href={`mailto:${supportEmail}`} className="hover:text-[var(--primary)]">
                  Contacto del organizador
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="fr-public-container flex flex-col gap-2 py-6 text-xs text-[var(--foreground-muted)] sm:flex-row sm:justify-between">
          <p>© {year} FotoRank. Todos los derechos reservados.</p>
          <p>fotorank.com</p>
        </div>
      </div>
    </footer>
  );
}
