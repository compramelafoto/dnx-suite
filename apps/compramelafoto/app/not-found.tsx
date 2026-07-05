import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-8 py-16 text-center">
      <img src="/watermark.png" alt="ComprameLaFoto" className="h-24 w-24 opacity-80" />
      <h1 className="text-3xl font-semibold text-[#111827]">Página no encontrada</h1>
      <p className="max-w-md text-base leading-relaxed text-[#6b7280]">
        La ruta que buscás no existe o aún no fue importada al monorepo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-lg border border-[#e5e7eb] px-5 py-3 text-sm font-medium text-[#111827] hover:border-[#c27b3d]"
        >
          Ir al inicio
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-[#c27b3d] px-5 py-3 text-sm font-medium text-white hover:bg-[#a86a33]"
        >
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
