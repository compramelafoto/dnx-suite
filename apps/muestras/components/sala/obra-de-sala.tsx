import Link from "next/link";
import { dateRangeText } from "@repo/muestras";
import { FotosPortfolio, type FotoPortfolio } from "@/components/ficha/fotos-portfolio";
import { BotonAdquirir } from "./boton-adquirir";

export type DatosObraDeSala = {
  muestra: { id: string; slug: string; title: string };
  obra: { id: string; title: string; authorName: string; detalle: string; statement: string | null; imagen: string };
  artista: {
    slug: string; nombre: string; bio: string | null; ciudad: string | null; website: string | null; instagram: string | null; avatarUrl: string | null;
  } | null;
  portfolio: FotoPortfolio[];
  otrasObras: { id: string; title: string; imagen: string }[];
  otrasMuestras: { slug: string; title: string; startsAt: Date; endsAt: Date }[];
  mostrarAdquirir: boolean;
};

const enlace = "underline underline-offset-[6px]";

/**
 * La obra tal como se ve con el pase de sala (spec D31): la foto (por proxy), sus datos, el artista
 * con su biografía completa, sus otras obras permitidas, su portfolio y dónde más expuso. Nunca el
 * precio.
 */
export function ObraDeSala({ d }: { d: DatosObraDeSala }) {
  const { muestra: a, obra, artista } = d;
  const sala = (id: string) => `/m/${encodeURIComponent(a.slug)}/sala/o/${encodeURIComponent(id)}`;
  return (
    <div className="space-y-10">
      <figure className="bg-[var(--mf-surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={obra.imagen} alt={`${obra.title}, de ${obra.authorName}`} className="mx-auto max-h-[80vh] w-auto object-contain" />
      </figure>

      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3.25rem)]">{obra.title}</h1>
        <p className="text-lg">{obra.authorName}</p>
        {obra.detalle ? <p className="text-[var(--mf-muted)]">{obra.detalle}</p> : null}
        {obra.statement ? <p className="max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed">{obra.statement}</p> : null}
        {d.mostrarAdquirir ? <p className="pt-2"><BotonAdquirir slug={a.slug} workId={obra.id} /></p> : null}
      </header>

      {artista ? (
        <section aria-labelledby="t-artista" className="space-y-4 border-t border-[var(--mf-line)] pt-6">
          <div className="flex items-center gap-4">
            {artista.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artista.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
            ) : null}
            <div>
              <h2 id="t-artista" className="text-xl">Sobre {artista.nombre}</h2>
              {artista.ciudad ? <p className="text-sm text-[var(--mf-muted)]">{artista.ciudad}</p> : null}
            </div>
          </div>
          {artista.bio ? <p className="max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed">{artista.bio}</p> : null}
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
            {artista.website ? <a href={artista.website} className={enlace} rel="noopener noreferrer" target="_blank">Sitio web</a> : null}
            {artista.instagram ? <a href={`https://www.instagram.com/${encodeURIComponent(artista.instagram)}/`} className={enlace} rel="noopener noreferrer" target="_blank">Instagram</a> : null}
            <Link href={`/fotografos/${artista.slug}`} className={enlace}>Ver perfil</Link>
          </p>
        </section>
      ) : null}

      {d.otrasObras.length ? (
        <section aria-labelledby="t-otras" className="space-y-3 border-t border-[var(--mf-line)] pt-6">
          <h2 id="t-otras" className="text-lg">Otras obras de {artista?.nombre ?? obra.authorName} en esta muestra</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {d.otrasObras.map((o) => (
              <li key={o.id}>
                <Link href={sala(o.id)} className="block space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.imagen} alt="" loading="lazy" className="aspect-square w-full bg-[var(--mf-surface)] object-cover" />
                  <span className="block text-[15px]">{o.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.portfolio.length ? (
        <section aria-labelledby="t-portfolio" className="space-y-3 border-t border-[var(--mf-line)] pt-6">
          <h2 id="t-portfolio" className="text-lg">Portfolio de {artista?.nombre ?? obra.authorName}</h2>
          <FotosPortfolio fotos={d.portfolio} autor={artista?.nombre ?? obra.authorName} columnas="grid-cols-3 sm:grid-cols-6" />
        </section>
      ) : null}

      {d.otrasMuestras.length ? (
        <section aria-labelledby="t-tambien" className="space-y-3 border-t border-[var(--mf-line)] pt-6">
          <h2 id="t-tambien" className="text-lg">También expuso en</h2>
          <ul className="space-y-1 text-[15px]">
            {d.otrasMuestras.map((m) => (
              <li key={m.slug}>
                <Link href={`/m/${m.slug}`} className={enlace}>{m.title}</Link>{" "}
                <span className="text-[var(--mf-muted)]">· {dateRangeText(m.startsAt, m.endsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--mf-line)] pt-4 text-[15px]">
        <Link href={`/m/${a.slug}`} className={enlace}>Ver toda la muestra</Link>
        <Link href={`/m/${a.slug}/sala`} className={enlace}>Lo que escaneaste</Link>
      </nav>
    </div>
  );
}
