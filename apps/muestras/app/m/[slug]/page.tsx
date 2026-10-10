import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACTIVITY_TYPE_LABELS, formatArDay, guestbookState, openingHasTime, openingWhenText, parseVisibility, rsvpState, temporalStatus, visibleWorks,
  type ActivityType,
} from "@repo/muestras";
import { ContarVisita } from "@/components/estadisticas/contar-visita";
import { Artistas } from "@/components/ficha/artistas";
import { EstadoActividad } from "@/components/ficha/estado";
import { Galeria } from "@/components/ficha/galeria";
import { GaleriaRotativa } from "@/components/ficha/galeria-rotativa";
import { UltimosComentarios } from "@/components/libro/ultimos-comentarios";
import { artistasDeMuestra } from "@/lib/actividades/artistas";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { entradasPublicadas } from "@/lib/libro/consultas";
import { esUrlWeb } from "@/lib/url";

// Cinco minutos: también alcanza para "cambian cada día" (el sorteo del día nuevo aparece a lo sumo
// unos minutos después de la medianoche argentina). Ninguna página pública lee cookies.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await buscarPorSlug((await params).slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.description.slice(0, 160),
    openGraph: { title: a.title, description: a.description.slice(0, 160), images: esUrlWeb(a.coverImageUrl) ? [a.coverImageUrl] : [] },
  };
}

export default async function Ficha({ params }: Props) {
  const a = await buscarPorSlug((await params).slug);
  if (!a) notFound();
  const ahora = new Date();
  const v = parseVisibility(a.visibility, a.galleryMode);
  // La sorpresa (etapa 6): sólo lo que `visibleWorks` deja ver online. En "cambian para cada
  // visitante" no viaja ninguna obra: la galería las pide a /api/m/<slug>/anticipo.
  const g = visibleWorks(a, a.works, ahora);
  const esMuestra = a.type === "MUESTRA";
  const artistas = esMuestra ? artistasDeMuestra(a, v) : [];
  // Al cliente viaja sólo lo que muestra la galería: ni ids de usuario o de perfil ni fechas.
  const works = g.works
    .filter((w) => esUrlWeb(w.imageUrl))
    .map(({ id, imageUrl, title, authorName, year, technique }) => ({ id, imageUrl, title, authorName, year, technique }));
  // Libro de visitas: sólo en muestras publicadas; cerrado o apagado, se ven los comentarios que ya hay.
  const libro = a.type === "MUESTRA" ? guestbookState(a, ahora) : "UNAVAILABLE";
  // Invitación a la inauguración (etapa 5): con confirmación abierta, o sólo los datos si es entrada libre.
  const asistencia = rsvpState(a, ahora);
  const ultimas = libro === "UNAVAILABLE" ? [] : await entradasPublicadas(a.id, 6);
  const mapa = a.latitude != null && a.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=17/${a.latitude}/${a.longitude}`
    : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <ContarVisita actividad={a.id} />
      <Link href="/" className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a todas las muestras</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {esUrlWeb(a.coverImageUrl) ? <img src={a.coverImageUrl} alt="" className="max-h-[60vh] w-full rounded-[2px] object-cover" /> : null}
      <header className="space-y-2">
        <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{a.title}</h1>
        <p className="text-[var(--mf-muted)]">{ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type}. Organiza {a.organizersText}</p>
      </header>
      {a.isCancelled ? <p className="rounded-[2px] bg-[#a1251b]/10 p-3 text-[#8a1f17]">Esta actividad se suspendió.</p> : null}
      <dl className="grid gap-4 border-y border-[var(--mf-line)] py-5 sm:grid-cols-2">
        <div><dt className="text-sm text-[var(--mf-muted)]">Fechas</dt><dd>{formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}</dd></div>
        {a.openingAt ? (
          <div>
            <dt className="text-sm text-[var(--mf-muted)]">Inauguración</dt>
            <dd>{openingHasTime(a.openingAt) ? openingWhenText(a.openingAt, a.openingEndsAt) : formatArDay(a.openingAt)}</dd>
            {asistencia === "OPEN" ? (
              <dd><Link href={`/m/${a.slug}/inauguracion`} className="underline underline-offset-4">Confirmá tu asistencia</Link></dd>
            ) : asistencia === "OFF" ? (
              <dd><Link href={`/m/${a.slug}/inauguracion`} className="underline underline-offset-4">Ver la invitación</Link></dd>
            ) : null}
          </div>
        ) : null}
        <div><dt className="text-sm text-[var(--mf-muted)]">Horarios</dt><dd>{a.scheduleText}</dd></div>
        <div><dt className="text-sm text-[var(--mf-muted)]">Entrada</dt><dd>{a.priceText || "Libre y gratuita"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-[var(--mf-muted)]">Lugar</dt>
          <dd>{a.isVirtualOnly ? "Online" : <>{a.venueName ? `${a.venueName}, ` : ""}{a.address}{a.city ? `, ${a.city}` : ""}{a.province ? `, ${a.province}` : ""}{mapa ? <><br /><a href={mapa} className="text-[var(--mf-accent)] underline underline-offset-4" target="_blank" rel="noreferrer">Cómo llegar</a></> : null}</>}</dd>
        </div>
        {esUrlWeb(a.externalUrl) ? <div className="sm:col-span-2"><a href={a.externalUrl} className="text-[var(--mf-accent)] underline underline-offset-4" target="_blank" rel="noreferrer">Más información</a></div> : null}
      </dl>
      <div className="whitespace-pre-line">{a.description}</div>
      {a.type === "MUESTRA" && a.curatorialText ? (
        <section aria-labelledby="t-curatorial" className="space-y-3 border-t border-[var(--mf-line)] pt-6">
          <h2 id="t-curatorial" className="mf-titulo text-[1.6rem]">Texto curatorial</h2>
          <div className="max-w-[68ch] whitespace-pre-line leading-relaxed">{a.curatorialText}</div>
          {a.curatorCredits ? <p className="text-[var(--mf-muted)]">{a.curatorCredits}</p> : null}
        </section>
      ) : null}
      {esMuestra && g.perVisit ? (
        <GaleriaRotativa slug={a.slug} cantidad={g.perVisit.count} />
      ) : esMuestra && works.length > 0 ? (
        <Galeria obras={works} parcial={g.isPartial} cerrada={temporalStatus(a, ahora) === "CLOSED"} slug={a.slug} seRevela={v.revealAfterClose} />
      ) : esMuestra && a.works.length > 0 ? (
        <section className="space-y-2 border-t border-[var(--mf-line)] pt-6">
          <h2 className="mf-titulo text-[clamp(1.5rem,3vw,2rem)]">Las obras</h2>
          <p className="text-[var(--mf-muted)]">
            {artistas.length > 0 ? "Las obras se descubren en la sala. Acá podés conocer a los artistas." : "Las obras se descubren en la sala."}
          </p>
        </section>
      ) : null}
      <Artistas artistas={artistas} />
      {libro !== "UNAVAILABLE" ? <UltimosComentarios slug={a.slug} entradas={ultimas} abierto={libro === "OPEN"} /> : null}
    </main>
  );
}
