import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { origenPublico, type Marca, type MarcaId } from "@/lib/marca";
import { rutaDePerfil } from "@/lib/perfiles/casa";
import { listarAutores } from "@/lib/perfiles/consultas";
import { marcaDeParams } from "@/lib/ruta-marca";
import { esUrlWeb } from "@/lib/url";

type Ruta = Marca["rutaAutores"];
type Params = Promise<{ marca: string }>;

/** En fotografía, los textos de siempre; en arte, los de todas las disciplinas. */
const TEXTOS: Record<MarcaId, { descripcion: string; intro: string }> = {
  FOTOGRAFIA: {
    descripcion: "Autores que colgaron sus obras en muestras de fotografía de todo el país.",
    intro: "Autores que colgaron sus obras en muestras de todo el país.",
  },
  ARTE: {
    descripcion: "Artistas que colgaron sus obras en muestras de arte de todo el país.",
    intro: "Artistas de todas las disciplinas que colgaron sus obras en muestras de todo el país.",
  },
};

/**
 * `/fotografos` (fotografía: sólo perfiles de casa fotografía) y `/artistas` (arte: todos). Cada
 * dominio tiene la suya: pedida en el otro, 308 a la de ese dominio.
 * Mientras no haya perfiles publicados, la página vacía no se indexa.
 */
export async function metadatosDeAutores(params: Params, ruta: Ruta): Promise<Metadata> {
  const marca = await marcaDeParams(params);
  if (marca.rutaAutores !== ruta) return {};
  const vacia = (await listarAutores(marca.id)).length === 0;
  return {
    title: marca.palabraAutor.titulo,
    description: TEXTOS[marca.id].descripcion,
    alternates: { canonical: `${origenPublico(marca)}${marca.rutaAutores}` },
    ...(vacia ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function PaginaAutores({ params, ruta }: { params: Params; ruta: Ruta }) {
  const marca = await marcaDeParams(params);
  if (marca.rutaAutores !== ruta) permanentRedirect(marca.rutaAutores);
  const perfiles = await listarAutores(marca.id);
  return (
    <main className="mf-marco py-10 sm:py-16">
      <h1 className="mf-titulo max-w-[16ch] text-[clamp(2.2rem,5vw,3.5rem)]">{marca.palabraAutor.titulo}</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">{TEXTOS[marca.id].intro}</p>
      {perfiles.length === 0 ? (
        <p className="mt-10 border-t border-[var(--mf-line)] pt-8 text-lg">Todavía no hay perfiles publicados.</p>
      ) : (
        <ul className="mt-10 grid border-t border-[var(--mf-line)] sm:grid-cols-2 lg:grid-cols-3">
          {perfiles.map((p) => {
            const n = new Set(p.works.map((w) => w.activityId)).size;
            return (
              <li key={p.slug} className="border-b border-[var(--mf-line)]">
                <Link href={rutaDePerfil(marca, p.slug)} className="group flex items-center gap-4 py-5 pr-4">
                  {esUrlWeb(p.avatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="size-14 shrink-0 rounded-full bg-[var(--mf-surface)]" />
                  )}
                  <span className="min-w-0">
                    <span className="mf-titulo block text-xl underline-offset-[5px] group-hover:underline">{p.displayName}</span>
                    <span className="text-[13px] text-[var(--mf-muted)]">{[p.city, n === 1 ? "1 muestra" : `${n} muestras`].filter(Boolean).join(". ")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
