import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, applyFilter, formatArDay, isActivityType, type ActivityType } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { Filtros } from "@/components/listado/filtros";
import { MapaNacionalCliente } from "@/components/mapa/mapa-nacional-cliente";
import { listarPublicas } from "@/lib/actividades/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

type Busqueda = { provincia?: string; tipo?: string; abiertas?: string; archivo?: string };

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
  const puntos = lista.flatMap((a) => (a.latitude != null && a.longitude != null && !a.isCancelled
    ? [{ slug: a.slug, title: a.title, latitude: a.latitude, longitude: a.longitude, etiqueta: `${formatArDay(a.startsAt)} al ${formatArDay(a.endsAt)}${a.city ? ` · ${a.city}` : ""}` }]
    : []));

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--mf-serif)] text-4xl">Muestras Fotográficas</h1>
          <p className="text-[var(--mf-muted)]">Las muestras y actividades de fotografía de todo el país, en un mapa.</p>
        </div>
        <Link href="/proponer" className="rounded-md bg-[var(--mf-accent)] px-4 py-2 text-white">Proponé tu muestra</Link>
      </header>
      <Filtros provincias={provincias} actual={sp} />
      <MapaNacionalCliente puntos={puntos} />
      {lista.length === 0 ? <p>No hay actividades con esos filtros.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-md border border-[var(--mf-line)] bg-white">
              <Link href={`/m/${a.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {esUrlWeb(a.coverImageUrl) ? <img src={a.coverImageUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : null}
                <div className="space-y-1 p-3">
                  <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
                  <h2 className="text-lg font-medium">{a.title}</h2>
                  <p className="text-sm text-[var(--mf-muted)]">
                    {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type} · {formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}
                    {a.isVirtualOnly ? " · Virtual" : a.city ? ` · ${a.city}, ${a.province ?? ""}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
