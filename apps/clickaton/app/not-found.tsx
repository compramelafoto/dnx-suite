import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ck-bg px-4 text-center text-ck-text">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">404</p>
      <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide">
        Página no encontrada
      </h1>
      <Link href="/" className="text-sm text-ck-yellow hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
