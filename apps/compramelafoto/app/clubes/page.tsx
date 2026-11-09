import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Images, ScanFace, UserCheck, Wallet } from "lucide-react";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  CONTENIDO_CLUBES,
  paginaClubesVisible,
  type ClaveFuncionClubes,
} from "@/lib/landing-clubes/contenido";

/*
 * Página para clubes y organizadores de eventos. Queda oculta (404) hasta que Daniel apruebe el texto
 * y se cargue CLF_PAGINA_CLUBES_PUBLICADA=1 en Vercel. Mientras tanto la ve sólo un admin.
 * FOTOFFICE (lib/agentes/vendedor/clf.ts) la da por publicada sólo si /clubes responde 200.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clubes y organizadores | ComprameLaFoto",
  description: CONTENIDO_CLUBES.bajada,
};

const ICONOS: Record<ClaveFuncionClubes, LucideIcon> = {
  COMISION_ORGANIZADOR: Wallet,
  FOTOGRAFOS_OFICIALES: UserCheck,
  VENTA_EN_ALBUM: Images,
  RECONOCIMIENTO_FACIAL: ScanFace,
};

export default async function ClubesPage() {
  const publicada = process.env.CLF_PAGINA_CLUBES_PUBLICADA === "1";
  let esAdmin = false;
  if (!publicada) {
    const user = await getAuthUser();
    esAdmin = user?.role === Role.ADMIN || String(user?.role) === "SUPER_ADMIN";
  }
  if (!paginaClubesVisible({ publicada, esAdmin })) notFound();

  const c = CONTENIDO_CLUBES;

  return (
    <main className="clf-landing min-w-0 bg-white pb-16 text-[#111827]">
      {!publicada ? (
        <p className="m-0 bg-[#fef3c7] px-4 py-2 text-center text-sm font-semibold text-[#92400e]">
          Vista previa para administradores: esta página todavía no está publicada.
        </p>
      ) : null}

      <section className="relative overflow-hidden border-b border-[#e5e7eb] bg-[#f7f5f2] py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.16),transparent_55%)]" />
        <div className="clf-container relative min-w-0 max-w-[900px]">
          <p className="m-0 inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
            Para clubes y organizadores
          </p>
          <h1 className="clf-hero-title mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.5rem]">
            {c.titulo}
          </h1>
          <p className="clf-hero-text mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">{c.bajada}</p>
          <div className="mt-8">
            <Link
              href={c.cta.href}
              className="clf-btn clf-btn--primary !inline-flex min-h-[3rem] w-full justify-center px-6 py-3 text-center !whitespace-normal sm:w-auto"
            >
              {c.cta.texto}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="clf-container min-w-0">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">Recorrido</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">Cómo funciona</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.pasos.map((paso, i) => (
              <article key={paso.titulo} className="flex min-w-0 flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <span className="text-sm font-semibold text-[#9a5c2a]">Paso {i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{paso.titulo}</h3>
                <p className="ds-readable-text ds-readable-text--fluid mt-2 m-0 max-w-none text-sm leading-relaxed text-[#4b5563]">
                  {paso.texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f9fafb] py-12 sm:py-16">
        <div className="clf-container min-w-0">
          <h2 className="m-0 text-2xl font-semibold leading-tight sm:text-3xl">Lo que ya tenés en ComprameLaFoto</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {c.funciones.map((f) => {
              const Icono = ICONOS[f.clave];
              return (
                <article key={f.clave} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3f4f6] text-[#9a5c2a]">
                    <Icono className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold sm:text-lg">{f.titulo}</h3>
                  <p className="ds-readable-text ds-readable-text--fluid mt-2 m-0 max-w-none text-sm text-[#4b5563]">{f.texto}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="clf-section clf-section--dark clf-section--viewport-centered">
        <div className="clf-container">
          <div className="clf-section-header clf-section-header--center w-full">
            <h2 className="clf-section-title">{c.titulo}</h2>
          </div>
          <div className="mt-8 flex w-full justify-center">
            <Link href={c.cta.href} className="clf-btn clf-btn--primary clf-btn--block w-full max-w-md text-center sm:w-auto sm:min-w-[16rem]">
              {c.cta.texto}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
