import Image from "next/image";
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, applyFilter, formatArDay, isActivityType, temporalStatus, type ActivityType } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { Filtros } from "@/components/listado/filtros";
import { MapaNacionalCliente } from "@/components/mapa/mapa-nacional-cliente";
import { listarPublicas } from "@/lib/actividades/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

/**
 * El logo grande de la portada. Está en un solo lugar para cambiarlo fácil: cuando llegue la
 * variante con luces cálidas (`/brand/muestras-logo-grande.webp`) alcanza con tocar esta línea.
 */
const LOGO_GRANDE = "/brand/muestras-logo-1254.webp";

const botonPrimario = "inline-flex h-12 items-center rounded-[10px] bg-[var(--mf-accent)] px-5 font-medium text-[var(--mf-accent-ink)] hover:bg-[var(--mf-deep)]";
const botonSecundario = "inline-flex h-12 items-center rounded-[10px] border border-[var(--mf-line)] px-5 font-medium text-[var(--mf-ink)] hover:border-[var(--mf-accent)] hover:text-[var(--mf-accent)]";

type Busqueda = { provincia?: string; tipo?: string; abiertas?: string; archivo?: string };

const PASOS = ["Cargás la ficha y las fotos.", "La revisamos.", "Aparece en el mapa y en la galería."];

export default async function Inicio({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  const ahora = new Date();
  const todas = await listarPublicas();
  const lista = applyFilter(todas, {
    province: sp.provincia || undefined,
    type: isActivityType(sp.tipo) ? sp.tipo : undefined,
    openNow: sp.abiertas === "1",
    includeClosed: sp.archivo === "1",
  }, ahora);
  const provincias = [...new Set(todas.map((a) => a.province).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "es"));
  const lugarDe = (a: (typeof todas)[number]) => (a.isVirtualOnly ? "Virtual" : [a.venueName, a.city, a.province].filter(Boolean).join(", "));
  const puntos = lista.flatMap((a) => (a.latitude != null && a.longitude != null && !a.isCancelled
    ? [{ slug: a.slug, title: a.title, latitude: a.latitude, longitude: a.longitude, etiqueta: `${formatArDay(a.startsAt)} al ${formatArDay(a.endsAt)}`, lugar: a.city }]
    : []));
  const abiertasHoy = todas.filter((a) => a.type === "MUESTRA" && !a.isCancelled && temporalStatus(a, ahora) === "OPEN").length;

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:pb-20 lg:pt-16">
        <div className="space-y-6">
          <h1 className="mf-titulo max-w-[14ch] text-[clamp(2.5rem,6vw,4rem)]">Las muestras de fotografía del país, en un mapa.</h1>
          <p className="max-w-md text-lg text-[var(--mf-muted)]">Encontrá qué ver cerca tuyo y publicá la tuya.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#mapa" className={botonPrimario}>Ver el mapa</a>
            <Link href="/proponer" className={botonSecundario}>Proponé tu muestra</Link>
          </div>
          {abiertasHoy > 0 ? (
            <p className="flex items-center gap-2 text-sm text-[var(--mf-muted)]">
              <span aria-hidden className="size-2 rounded-full bg-[var(--mf-teal)]" />
              {abiertasHoy === 1 ? "1 muestra abierta hoy" : `${abiertasHoy} muestras abiertas hoy`}
            </p>
          ) : null}
        </div>
        <Image
          src={LOGO_GRANDE}
          alt=""
          width={420}
          height={420}
          priority
          sizes="(min-width: 1024px) 420px, 220px"
          className="mf-apertura size-[220px] justify-self-center lg:size-[420px] lg:justify-self-end"
        />
      </section>

      <section id="mapa" aria-labelledby="titulo-mapa" className="mx-auto max-w-6xl scroll-mt-4 space-y-5 px-4 pb-16 sm:px-8">
        <h2 id="titulo-mapa" className="sr-only">Mapa y lista de actividades</h2>
        <Filtros provincias={provincias} actual={sp} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-[360px] min-w-0 sm:h-[460px] lg:col-span-7 lg:h-[600px]">
            <MapaNacionalCliente puntos={puntos} />
          </div>
          <div className="min-w-0 lg:col-span-5 lg:h-[600px] lg:overflow-y-auto lg:pr-1">
            {lista.length === 0 ? (
              <div className="space-y-4 border-t border-[var(--mf-line)] py-8">
                <p className="text-[var(--mf-muted)]">Todavía no hay muestras publicadas con estos filtros.</p>
                <Link href="/proponer" className={botonPrimario}>Proponé la tuya</Link>
              </div>
            ) : (
              <>
                <p className="pb-2 text-sm text-[var(--mf-muted)]">{lista.length === 1 ? "1 actividad" : `${lista.length} actividades`}</p>
                <ul className="border-t border-[var(--mf-line)]">
                  {lista.map((a) => (
                    <li key={a.id} className="border-b border-[var(--mf-line)]">
                      <Link href={`/m/${a.slug}`} className="flex gap-4 rounded-[10px] px-2 py-4 hover:bg-[var(--mf-surface)]">
                        {esUrlWeb(a.coverImageUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.coverImageUrl} alt="" className="size-[88px] shrink-0 rounded-[10px] object-cover" loading="lazy" />
                        ) : (
                          <span aria-hidden className="size-[88px] shrink-0 rounded-[10px] bg-[var(--mf-surface)]" />
                        )}
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-semibold leading-snug">{a.title}</span>
                          <span className="block truncate text-sm text-[var(--mf-muted)]">{lugarDe(a) || ACTIVITY_TYPE_LABELS[a.type as ActivityType] || a.type}</span>
                          <span className="block text-sm text-[var(--mf-muted)]">
                            {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type}, del {formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}
                          </span>
                          <span className="block pt-1">
                            <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[var(--mf-deep)] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-12 lg:items-end lg:py-20">
          <div className="space-y-6 lg:col-span-8">
            <h2 className="mf-titulo text-[clamp(1.95rem,4vw,2.45rem)]">¿Organizás una muestra?</h2>
            <ol className="grid gap-5 sm:grid-cols-3">
              {PASOS.map((paso, i) => (
                <li key={paso} className="flex gap-3 sm:block sm:space-y-2">
                  <span aria-hidden className="mf-titulo block text-2xl text-[var(--mf-line)]">{i + 1}</span>
                  <span className="block text-white/90">{paso}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <Link href="/proponer" className="inline-flex h-12 items-center rounded-[10px] bg-white px-5 font-medium text-[var(--mf-deep)] hover:bg-[var(--mf-surface)] focus-visible:outline-white">
              Proponé tu muestra
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
