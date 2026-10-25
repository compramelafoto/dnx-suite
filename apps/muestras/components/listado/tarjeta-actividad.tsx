import Link from "next/link";
import { distanceLabel, formatArDay } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { esUrlWeb } from "@/lib/url";

type Props = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  tipo: string;
  lugar: string;
  startsAt: Date;
  endsAt: Date;
  isCancelled: boolean;
  distanceKm: number | null;
  ahora: Date;
  /** Las primeras del listado se cargan enseguida; el resto, al acercarse. */
  prioridad?: boolean;
};

/**
 * Una actividad del listado como pieza de programa de sala: la portada manda, debajo el estado,
 * el título, dónde y cuándo. Sin portada queda la niebla con el tipo, para no romper la grilla.
 */
export function TarjetaActividad(p: Props) {
  const distancia = distanceLabel(p.distanceKm);
  return (
    <Link href={`/m/${p.slug}`} className="group block">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[2px] bg-[var(--mf-surface)]">
        {esUrlWeb(p.coverImageUrl) ? (
          <img
            src={p.coverImageUrl}
            alt=""
            loading={p.prioridad ? "eager" : "lazy"}
            decoding="async"
            className={`size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${p.isCancelled ? "grayscale" : ""}`}
          />
        ) : (
          <span aria-hidden className="flex size-full items-center justify-center text-[13px] uppercase tracking-[0.14em] text-[var(--mf-muted)]">{p.tipo}</span>
        )}
      </span>
      <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--mf-muted)]">
        {p.tipo}
        <EstadoActividad startsAt={p.startsAt} endsAt={p.endsAt} isCancelled={p.isCancelled} ahora={p.ahora} />
      </span>
      <span className="mf-titulo mt-2 block text-[clamp(1.35rem,2vw,1.6rem)] leading-[1.08] underline-offset-[5px] group-hover:underline">{p.title}</span>
      <span className="mt-3 block text-[15px] leading-snug">{p.lugar}</span>
      <span className="mt-1 flex flex-wrap gap-x-3 text-[15px] tabular-nums text-[var(--mf-muted)]">
        <span>{formatArDay(p.startsAt)} al {formatArDay(p.endsAt)}</span>
        {distancia ? <span>· {distancia}</span> : null}
      </span>
    </Link>
  );
}
