import Link from "next/link";

const enlace = "underline-offset-4 hover:text-[var(--mf-ink)] hover:underline";

/** Pie común: los dos legales y de quién es el sitio. */
export function Pie() {
  return (
    <footer className="border-t border-[var(--mf-line)] text-[13px] text-[var(--mf-muted)]">
      <div className="mf-marco flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-6">
        <p>Muestras Fotográficas es parte de DNX Suite.</p>
        <nav aria-label="Más" className="flex gap-5">
          <Link href="/convocatorias" className={enlace}>Convocatorias</Link>
          <Link href="/fotografos" className={enlace}>Fotógrafos</Link>
          <Link href="/privacidad" className={enlace}>Privacidad</Link>
          <Link href="/terminos" className={enlace}>Términos</Link>
        </nav>
      </div>
    </footer>
  );
}
