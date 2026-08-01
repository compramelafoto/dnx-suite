import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ck-bg px-4 text-center text-ck-text">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
        Página no disponible
      </p>
      <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide">
        No encontramos esta página
      </h1>
      <p className="max-w-md text-sm text-ck-text-secondary">
        Es posible que el enlace haya cambiado o que la sección ya no esté disponible.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ck-yellow px-5 text-sm font-semibold text-ck-bg"
        >
          Volver al inicio
        </Link>
        <Link
          href="/mi-cuenta"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-ck-border px-5 text-sm font-semibold text-ck-text"
        >
          Ir a Mi cuenta
        </Link>
      </div>
    </div>
  );
}
