import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, applyFilter, cleanPlaceLabel, distanceLabel, formatArDay, formatNearParam, isActivityType, parseNearParam, temporalStatus, withDistance, type ActivityType } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { Filtros } from "@/components/listado/filtros";
import { MapaNacionalCliente } from "@/components/mapa/mapa-nacional-cliente";
import { Banner } from "@/components/portada/banner";
import { listarPublicas } from "@/lib/actividades/consultas";
import { FOTOS_PORTADA } from "@/lib/portada/fotos";
import { PASOS_MUESTRA } from "@/lib/portada/funciones";
import { TextoDePaso } from "@/components/portada/texto-de-paso";

export const revalidate = 300;

type Busqueda = { provincia?: string; tipo?: string; abiertas?: string; archivo?: string; cerca?: string; lugar?: string };

const accionFina = "inline-flex h-11 items-center border border-[var(--mf-ink)] px-5 text-[15px] transition-colors hover:bg-[var(--mf-ink)] hover:text-white";


export default async function Inicio({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  const ahora = new Date();
  const todas = await listarPublicas();
  const filtradas = applyFilter(todas, {
    province: sp.provincia || undefined,
    type: isActivityType(sp.tipo) ? sp.tipo : undefined,
    openNow: sp.abiertas === "1",
    includeClosed: sp.archivo === "1",
  }, ahora);
  // "Cerca de": viene de la URL, así que se valida estricto; `lugar` es sólo texto para mostrar.
  const origen = parseNearParam(sp.cerca);
  const lugarBuscado = origen ? (cleanPlaceLabel(sp.lugar) ?? "el punto elegido") : null;
  const lista = origen ? withDistance(origen, filtradas) : filtradas.map((a) => ({ ...a, distanceKm: null as number | null }));
  const sinCerca = new URLSearchParams(
    Object.entries({ provincia: sp.provincia, tipo: sp.tipo, abiertas: sp.abiertas, archivo: sp.archivo })
      .filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
  ).toString();
  const provincias = [...new Set(todas.map((a) => a.province).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "es"));
  // Una muestra siempre tiene sede; "Online" sólo puede aparecer en charlas o talleres.
  const lugarDe = (a: (typeof todas)[number]) => (a.isVirtualOnly ? "Online" : [a.venueName, a.city, a.province].filter(Boolean).join(", "));
  const puntos = lista.flatMap((a) => (a.latitude != null && a.longitude != null && !a.isCancelled
    ? [{ slug: a.slug, title: a.title, latitude: a.latitude, longitude: a.longitude, etiqueta: `${formatArDay(a.startsAt)} al ${formatArDay(a.endsAt)}`, lugar: a.city }]
    : []));
  const abiertasHoy = todas.filter((a) => a.type === "MUESTRA" && !a.isCancelled && temporalStatus(a, ahora) === "OPEN").length;

  const cuenta = [
    lista.length === 1 ? "1 actividad" : `${lista.length} actividades`,
    abiertasHoy > 0 ? (abiertasHoy === 1 ? "1 muestra abierta hoy" : `${abiertasHoy} muestras abiertas hoy`) : null,
  ].filter(Boolean).join(", ");

  return (
    <main>
      <Banner fotos={FOTOS_PORTADA} />

      <section aria-labelledby="titulo-funciones" className="mf-marco pt-20 sm:pt-28">
        <h2 id="titulo-funciones" className="mf-titulo max-w-[16ch] text-[clamp(2rem,4.5vw,3.5rem)]">Todo lo que podés hacer con tu muestra</h2>
        <p className="mt-5 max-w-[52ch] text-balance text-xl leading-snug">Organizás una muestra en una sala, una galería o un centro cultural. Acá encontrás todo para armarla, difundirla y llevar gente a verla.</p>
        <p className="mt-3 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Para fotógrafos, organizadores, fotoclubes e instituciones, de la convocatoria al archivo.</p>
        <ol className="mt-12 border-t border-[var(--mf-line)] sm:mt-16">
          {PASOS_MUESTRA.map((paso, i) => (
            <li key={paso.titulo} className="grid gap-x-10 gap-y-4 border-b border-[var(--mf-line)] py-8 sm:py-10 md:grid-cols-12">
              <div className="flex items-baseline gap-4 md:col-span-4">
                <span aria-hidden className="w-6 shrink-0 text-[15px] tabular-nums text-[var(--mf-muted)]">{i + 1}</span>
                <h3 className="mf-titulo text-[clamp(1.5rem,2.4vw,2rem)]">{paso.titulo}</h3>
              </div>
              <ul className="grid gap-x-10 gap-y-3 pl-10 text-[15px] leading-snug sm:grid-cols-2 md:col-span-8 md:pl-0">
                {paso.items.map((item) => <li key={item} className="max-w-[44ch]"><TextoDePaso texto={item} /></li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section id="muestras" aria-labelledby="titulo-muestras" className="mf-marco scroll-mt-16 pt-20 sm:pt-28">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 id="titulo-muestras" className="mf-titulo text-[clamp(2rem,4vw,3rem)]">Muestras</h2>
          {todas.length > 0 ? <p className="text-sm text-[var(--mf-muted)]">{cuenta}</p> : null}
        </div>
        <p className="mt-4 mb-8 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Muestras para visitar en persona: dónde quedan, fechas, horarios y cómo llegar, con un anticipo de las obras.</p>
        {origen ? (
          <p className="mb-6 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-l-2 border-[var(--mf-spot)] pl-4 text-lg">
            <span>Muestras cerca de {lugarBuscado}</span>
            <Link href={`/${sinCerca ? `?${sinCerca}` : ""}#muestras`} className="text-[15px] text-[var(--mf-muted)] underline underline-offset-[6px] hover:text-[var(--mf-ink)]">Ver todo el país</Link>
          </p>
        ) : null}
        {todas.length > 0 ? <div className="mb-6"><Filtros provincias={provincias} actual={sp} cerca={origen ? { cerca: formatNearParam(origen), lugar: cleanPlaceLabel(sp.lugar) } : null} /></div> : null}

        {todas.length === 0 ? (
          <div className="border-t border-[var(--mf-line)] pt-10 pb-4">
            <p className="mf-titulo max-w-[22ch] text-[clamp(1.6rem,3vw,2.25rem)]">Todavía no hay muestras publicadas.</p>
            <p className="mt-3 text-lg text-[var(--mf-muted)]">Sé el primero en proponer la tuya.</p>
            <Link href="/proponer" className={`${accionFina} mt-8`}>Proponé tu muestra</Link>
          </div>
        ) : lista.length === 0 ? (
          <div className="border-t border-[var(--mf-line)] pt-8">
            <p className="text-lg">No hay actividades con estos filtros.</p>
            <Link href="/#muestras" className="mt-3 inline-block text-[var(--mf-muted)] underline underline-offset-[6px] hover:text-[var(--mf-ink)]">Ver todas</Link>
          </div>
        ) : (
          <ul className="border-t border-[var(--mf-line)]">
            {lista.map((a) => {
              const tipo = ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type;
              return (
                <li key={a.id} className="border-b border-[var(--mf-line)]">
                  <Link href={`/m/${a.slug}`} className="group grid gap-x-8 gap-y-1.5 py-5 sm:py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_11rem] md:items-baseline">
                    <span className="min-w-0">
                      <span className="mf-titulo block text-[clamp(1.35rem,2.2vw,1.75rem)] leading-[1.1] underline-offset-[5px] group-hover:underline">{a.title}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--mf-muted)]">
                        {tipo}
                        <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
                      </span>
                    </span>
                    <span className="min-w-0 text-[15px] text-[var(--mf-muted)] md:text-[var(--mf-ink)]">
                      {lugarDe(a) || tipo}
                      {distanceLabel(a.distanceKm) ? <span className="block text-[13px] text-[var(--mf-muted)]">{distanceLabel(a.distanceKm)}</span> : null}
                    </span>
                    <span className="text-[15px] tabular-nums text-[var(--mf-muted)] md:text-right md:text-[var(--mf-ink)]">
                      {formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* El país es alto y angosto: en pantalla ancha el mapa va a la derecha, no como franja. */}
      <section id="mapa" aria-labelledby="titulo-mapa" className="mf-marco grid scroll-mt-16 gap-4 pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-8">
        <h2 id="titulo-mapa" className="text-sm text-[var(--mf-muted)] lg:col-span-4">{origen ? `En el mapa, cerca de ${lugarBuscado}` : "Dónde visitarlas"}</h2>
        <div className="h-[380px] min-w-0 sm:h-[480px] lg:col-span-8 lg:h-[600px]">
          <MapaNacionalCliente puntos={puntos} centro={origen} />
        </div>
      </section>

      <section aria-labelledby="titulo-organizadores" className="mf-marco py-24 sm:py-36">
        <h2 id="titulo-organizadores" className="mf-titulo max-w-[20ch] text-[clamp(2.1rem,5vw,4.25rem)] leading-[0.98]">
          ¿Organizás una muestra? Cargala con sus fotos y compartila con todo el mundo.
        </h2>
        <p className="mt-6 max-w-[48ch] text-lg leading-snug text-[var(--mf-muted)]">La muestra se vive en la sala. Acá la ponés en el mapa, contás cuándo y dónde, y mostrás un anticipo de las obras para que la gente vaya a verla.</p>
        <Link href="/proponer" className={`${accionFina} mt-10`}>Proponé tu muestra</Link>
      </section>
    </main>
  );
}
