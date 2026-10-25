import Link from "next/link";
import type { Artista } from "@/lib/actividades/artistas";
import { FotosPortfolio } from "./fotos-portfolio";

const BIO_CORTA = 280;
const recortar = (s: string) => (s.length <= BIO_CORTA ? s : `${s.slice(0, BIO_CORTA).replace(/\s+\S*$/, "")}…`);

/**
 * "Artistas" de la muestra (spec D26): conocer a quien expone sin ver lo que cuelga en la sala.
 * Recibe sólo lo que arma `artistasDeMuestra` (nunca obras expuestas).
 */
export function Artistas({ artistas }: { artistas: Artista[] }) {
  if (artistas.length === 0) return null;
  return (
    <section aria-labelledby="t-artistas" className="space-y-6 border-t border-[var(--mf-line)] pt-6">
      <h2 id="t-artistas" className="mf-titulo text-[clamp(1.5rem,3vw,2rem)]">Artistas</h2>
      <ul className="space-y-8">
        {artistas.map((x) => (
          <li key={x.key} className="space-y-3">
            <div className="flex items-center gap-4">
              {x.perfil?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.perfil.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              ) : null}
              <div>
                <h3 className="text-lg font-medium">
                  {x.perfil ? <Link href={`/fotografos/${x.perfil.slug}`} className="underline-offset-[5px] hover:underline">{x.nombre}</Link> : x.nombre}
                </h3>
                {x.perfil?.ciudad ? <p className="text-sm text-[var(--mf-muted)]">{x.perfil.ciudad}</p> : null}
              </div>
            </div>
            {x.perfil?.bio ? (
              <p className="max-w-[68ch] whitespace-pre-line leading-relaxed">
                {recortar(x.perfil.bio)}{" "}
                <Link href={`/fotografos/${x.perfil.slug}`} className="text-[var(--mf-accent)] underline underline-offset-4">Ver perfil</Link>
              </p>
            ) : null}
            <FotosPortfolio fotos={x.portfolio} autor={x.nombre} />
            {x.perfil && x.totalPortfolio > x.portfolio.length ? (
              <p><Link href={`/fotografos/${x.perfil.slug}#portfolio`} className="text-sm underline underline-offset-4">Ver portfolio</Link></p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
