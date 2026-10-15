import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { upcomingSection } from "@repo/muestras";
import { EN_PREPARACION } from "@/lib/panel/en-preparacion";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ seccion: string }> };

/** Las rutas estáticas del panel (muestras, perfil, montaje…) tienen prioridad sobre esta. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = upcomingSection((await params).seccion);
  return s ? { title: s.label } : {};
}

export default async function EnPreparacion({ params }: Props) {
  const s = upcomingSection((await params).seccion);
  const texto = s ? EN_PREPARACION[s.key] : undefined;
  if (!s || !texto) notFound();
  await requireUsuario(s.href);
  return (
    <main className="max-w-2xl space-y-8">
      <header className="space-y-4">
        <p className="text-sm text-[var(--mf-muted)]">En preparación</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{texto.titulo}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">{texto.bajada}</p>
      </header>
      <ul className="border-t border-[var(--mf-line)]">
        {texto.puntos.map((p) => <li key={p} className="border-b border-[var(--mf-line)] py-3 text-[15px]">{p}</li>)}
      </ul>
      <p className="text-[15px] text-[var(--mf-muted)]">
        Mientras tanto podés <Link href="/panel/proponer" className="text-[var(--mf-ink)] underline underline-offset-[6px]">proponer tu muestra</Link> y cargar sus obras.
      </p>
    </main>
  );
}
