import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-8 py-16 text-center md:px-12">
      <img src="/watermark.png" alt="ComprameLaFoto" className="h-24 w-24 opacity-80" />
      <h1 className="max-w-3xl text-3xl font-semibold text-[#111827]">Página no encontrada</h1>
      {/*
        Este texto lo lee el cliente final. La causa más común es un álbum vencido: los
        álbumes se publican por tiempo limitado y cualquier link viejo termina acá.
        Antes decía "aún no fue importada al monorepo", que era una nota para el equipo.
      */}
      <p className="max-w-2xl text-base leading-relaxed text-[#6b7280] text-balance">
        Puede que el álbum que buscás ya no esté disponible: se publican por tiempo
        limitado. Si te pasaron el link hace poco, pedile al fotógrafo que vuelva a
        compartirlo.
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
