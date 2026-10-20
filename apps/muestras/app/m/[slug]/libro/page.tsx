import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, guestbookSignature, guestbookState } from "@repo/muestras";
import { FormularioLibro } from "@/components/libro/formulario-libro";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { entradasPublicadas } from "@/lib/libro/consultas";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await buscarPorSlug((await params).slug);
  // Sin indexar: le quita a un spammer el incentivo de posicionar texto (D20).
  return a ? { title: `Libro de visitas: ${a.title}`, robots: { index: false } } : {};
}

export default async function LibroDeVisitas({ params }: Props) {
  const a = await buscarPorSlug((await params).slug);
  if (!a || a.type !== "MUESTRA") notFound();
  const estado = guestbookState(a, new Date());
  if (estado === "UNAVAILABLE") notFound();
  const entradas = await entradasPublicadas(a.id, 200);
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
      <Link href={`/m/${a.slug}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a la muestra</Link>
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">Libro de visitas</p>
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{a.title}</h1>
      </header>
      {estado === "OPEN" ? <FormularioLibro muestra={a.id} revisa={a.guestbookMode === "REVIEW"} /> : (
        // Libro cerrado (por quien organiza, muestra cancelada o pasado el plazo): nunca un 404,
        // porque el afiche impreso sigue colgado y alguien puede escanearlo.
        <p className="border-t border-[var(--mf-line)] pt-4 text-[15px] text-[var(--mf-muted)]">
          {estado === "ENDED" ? "El libro de visitas de esta muestra ya cerró. Gracias a todas las personas que dejaron su comentario." : "El libro de visitas de esta muestra está cerrado."}{" "}
          <Link href={`/m/${a.slug}`} className="underline underline-offset-4">Ver la muestra</Link>
        </p>
      )}
      <section aria-labelledby="t-comentarios" className="space-y-4">
        <h2 id="t-comentarios" className="text-sm text-[var(--mf-muted)]">{entradas.length ? "Comentarios" : "Todavía no hay comentarios."}</h2>
        <ul data-nosnippet className="border-t border-[var(--mf-line)]">
          {entradas.map((e) => (
            <li key={e.id} className="space-y-1 border-b border-[var(--mf-line)] py-4">
              <p className="whitespace-pre-line text-[17px] leading-relaxed">{e.comment}</p>
              <p className="text-sm text-[var(--mf-muted)]">{guestbookSignature(e)} · {formatArDay(e.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
