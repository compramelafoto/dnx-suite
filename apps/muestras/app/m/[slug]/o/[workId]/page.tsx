import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, neighborWorks, parseVisibility, visibleWorks, workAccess, workPath } from "@repo/muestras";
import { ContarVisita } from "@/components/estadisticas/contar-visita";
import { EstadoActividad } from "@/components/ficha/estado";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string; workId: string }> };

async function cargar(slug: string, workId: string, ahora: Date) {
  // `buscarPorSlug` ya filtra por reviewStatus "APPROVED": una muestra sin publicar no existe acá.
  const a = await buscarPorSlug(slug);
  if (!a || a.type !== "MUESTRA") return null;
  const obra = a.works.find((w) => w.id === workId);
  const acceso = workAccess(a, a.works, workId, ahora);
  if (!obra || !acceso) return null;
  // Una obra reservada por la sorpresa (o cualquiera en "para cada visitante") queda como aviso
  // sin imagen y `noindex`: ni la foto ni el `og:image` salen de acá.
  return { a, obra, conFoto: acceso === "FULL" && esUrlWeb(obra.imageUrl), seRevela: parseVisibility(a.visibility, a.galleryMode).revealAfterClose };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, workId } = await params;
  const r = await cargar(slug, workId, new Date());
  if (!r) return {};
  const titulo = `${r.obra.title}, de ${r.obra.authorName || "autor sin indicar"}`;
  const sede = r.a.isVirtualOnly ? null : [r.a.venueName, r.a.city].filter(Boolean).join(", ");
  const descripcion = `Obra de la muestra "${r.a.title}"${sede ? `, en ${sede}` : ""}.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: workPath(r.a.slug, r.obra.id) },
    // Sin la foto (la galería la reserva para la visita) no tiene sentido indexarla.
    robots: r.conFoto ? undefined : { index: false },
    openGraph: { title: titulo, description: descripcion, images: r.conFoto ? [r.obra.imageUrl] : [] },
  };
}

export default async function PaginaDeObra({ params }: Props) {
  const { slug, workId } = await params;
  const ahora = new Date();
  const r = await cargar(slug, workId, ahora);
  if (!r) notFound();
  const { a, obra, conFoto, seRevela } = r;
  const autor = obra.authorName || "Autor sin indicar";
  // Reservada para la sala: sólo título y autor (ni año ni técnica, que la describen).
  const datos = conFoto ? [obra.year ? String(obra.year) : null, obra.technique].filter(Boolean).join(". ") : "";
  const { prev, next } = conFoto ? neighborWorks(visibleWorks(a, a.works, ahora).works, obra.id) : { prev: null, next: null };
  const lugar = a.isVirtualOnly ? "Online" : [a.venueName, a.city].filter(Boolean).join(", ");

  return (
    <main className="mf-marco space-y-8 py-8 sm:py-12">
      <ContarVisita actividad={a.id} obra={obra.id} />
      <Link href={`/m/${a.slug}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px] hover:text-[var(--mf-ink)]">
        Volver a la muestra
      </Link>

      {conFoto ? (
        <figure className="bg-[var(--mf-surface)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={obra.imageUrl} alt={`${obra.title}, de ${autor}`} className="mx-auto max-h-[80vh] w-auto object-contain" />
        </figure>
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center bg-[var(--mf-surface)] p-8 text-center">
          <p className="max-w-[36ch] text-lg leading-snug">Esta obra se ve en la sala.{seRevela ? " Cuando la muestra cierra, queda online en el archivo de la muestra." : ""}</p>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-12">
        <header className="space-y-3 md:col-span-7">
          <h1 className="mf-titulo text-[clamp(2rem,5vw,3.25rem)]">{obra.title}</h1>
          <p className="text-lg">
            {obra.authorProfile ? (
              <Link href={`/fotografos/${obra.authorProfile.slug}`} className="underline underline-offset-[6px]">{autor}</Link>
            ) : autor}
          </p>
          {datos ? <p className="text-[var(--mf-muted)]">{datos}</p> : null}
        </header>
        <aside className="space-y-2 border-t border-[var(--mf-line)] pt-4 text-[15px] md:col-span-5 md:border-t-0 md:pt-0">
          <p className="text-sm text-[var(--mf-muted)]">Forma parte de la muestra</p>
          <p><Link href={`/m/${a.slug}`} className="font-medium underline underline-offset-[6px]">{a.title}</Link></p>
          <p className="text-[var(--mf-muted)]">{formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}{lugar ? `. ${lugar}` : ""}</p>
          <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
          {obra.authorProfile ? (
            <p className="pt-3">
              <Link href={`/fotografos/${obra.authorProfile.slug}`} className="underline underline-offset-[6px]">Más obras de {obra.authorProfile.displayName}</Link>
            </p>
          ) : null}
        </aside>
      </div>

      {prev || next ? (
        <nav aria-label="Otras obras de la muestra" className="flex justify-between gap-6 border-t border-[var(--mf-line)] pt-4 text-[15px]">
          {prev ? <Link href={workPath(a.slug, prev.id)} className="underline-offset-[6px] hover:underline">← {prev.title}</Link> : <span />}
          {next ? <Link href={workPath(a.slug, next.id)} className="text-right underline-offset-[6px] hover:underline">{next.title} →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
