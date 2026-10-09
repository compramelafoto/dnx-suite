import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CALL_PHASE_PUBLIC_TEXT, callMetaDescription, acceptsSubmissions, callPhase, formatArDay, hasPublicPage } from "@repo/muestras";
import { buscarConvocatoriaPublica } from "@/lib/convocatorias/consultas";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await buscarConvocatoriaPublica((await params).slug);
  if (!c) return {};
  return { title: c.title, description: callMetaDescription(c.basesText, `Convocatoria para exponer en la muestra ${c.activity.title}.`) };
}

const boton = "inline-flex h-12 items-center rounded-[2px] bg-[var(--mf-ink)] px-6 text-white";

export default async function ConvocatoriaPublica({ params }: Props) {
  const c = await buscarConvocatoriaPublica((await params).slug);
  const ahora = new Date();
  if (!c) notFound();
  const fase = callPhase(c, ahora);
  if (!hasPublicPage(fase)) notFound();
  const a = c.activity;
  // `buscarConvocatoriaPublica` sólo devuelve convocatorias de muestras con lugar físico.
  const lugar = [a.venueName, a.city, a.province].filter(Boolean).join(", ");

  return (
    <main className="mf-marco grid gap-12 py-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <article className="min-w-0 space-y-8">
        <header className="space-y-4">
          <p className="text-sm text-[var(--mf-muted)]">Convocatoria para exponer. {CALL_PHASE_PUBLIC_TEXT[fase]}</p>
          <h1 className="mf-titulo text-[clamp(2.2rem,5vw,3.5rem)]">{c.title}</h1>
          <p className="text-lg text-[var(--mf-muted)]">
            Para exponer en la muestra <Link href={`/m/${a.slug}`} className="underline underline-offset-[6px]">{a.title}</Link>
            {lugar ? `. ${lugar}` : ""}
          </p>
        </header>
        <section aria-labelledby="t-bases" className="space-y-3">
          <h2 id="t-bases" className="mf-titulo text-2xl">Bases</h2>
          <div className="whitespace-pre-line text-[17px] leading-relaxed">{c.basesText}</div>
        </section>
        {c.requirementsText ? (
          <section aria-labelledby="t-req" className="space-y-3">
            <h2 id="t-req" className="mf-titulo text-2xl">Las imágenes</h2>
            <div className="whitespace-pre-line text-[17px] leading-relaxed">{c.requirementsText}</div>
          </section>
        ) : null}
        <section aria-labelledby="t-der" className="space-y-3">
          <h2 id="t-der" className="mf-titulo text-2xl">Derechos</h2>
          <div className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--mf-muted)]">{c.rightsText}</div>
        </section>
      </article>
      <aside className="space-y-5 border-t border-[var(--mf-line)] pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
        <dl className="space-y-3 text-[15px]">
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Recibe obras</dt><dd>del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}</dd></div>
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Obras por persona</dt><dd>hasta {c.maxWorksPerPerson}</dd></div>
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Selección</dt><dd>anónima: el equipo curatorial ve las obras sin el nombre de su autor. Las elegidas se exponen en la muestra.</dd></div>
        </dl>
        {acceptsSubmissions(fase) ? (
          <Link href={`/convocatorias/${c.slug}/enviar`} className={boton}>Enviar obras</Link>
        ) : fase === "UPCOMING" ? (
          <p className="text-[15px]">Empieza a recibir obras el {formatArDay(c.opensAt)}.</p>
        ) : (
          <p className="text-[15px]">Esta convocatoria ya no recibe obras.</p>
        )}
        <p className="text-sm text-[var(--mf-muted)]">Para enviar hace falta entrar con tu cuenta de Google.</p>
      </aside>
    </main>
  );
}
