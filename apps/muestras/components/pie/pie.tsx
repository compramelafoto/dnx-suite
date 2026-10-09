import Link from "next/link";

const enlace = "rounded-[10px] text-[var(--mf-ink)] underline-offset-4 hover:underline";

/** Pie común: los dos legales y de quién es el sitio. */
export function Pie() {
  return (
    <footer className="border-t border-[var(--mf-line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-8 text-sm sm:px-8">
        <nav aria-label="Legales" className="flex gap-5">
          <Link href="/privacidad" className={enlace}>Privacidad</Link>
          <Link href="/terminos" className={enlace}>Términos</Link>
        </nav>
        <p className="text-[var(--mf-muted)]">Muestras Fotográficas es parte de DNX Suite.</p>
      </div>
    </footer>
  );
}
