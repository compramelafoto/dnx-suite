import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadOpenStore } from "@/lib/store/repository";
import { loadPublicArtworks } from "@/lib/store/artworks/storefront";
import { ArtworkGrid } from "@/components/store/artwork-grid";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ concurso?: string | string[]; pagina?: string | string[] }>;
};

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadOpenStore((await params).workspaceSlug);
  if (!store) return {};
  const title = `Obras — ${store.workspace.name}`;
  const description = `Copias impresas de las obras de los concursos de ${store.workspace.name}.`;
  return { title, description, openGraph: { title, description, siteName: store.workspace.name, locale: "es_AR" } };
}

/**
 * La vidriera de obras: las copias impresas de obras de concursos que la institución publicó, con
 * un filtro por concurso (`?concurso=<clave>`; una que no existe muestra todo) y de a 24
 * (`?pagina=`). Sólo aparecen las obras que se pueden vender hoy (ver `artworks/storefront.ts`).
 */
export default async function StoreArtworksPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();

  const sp = await searchParams;
  const pagina = Number.parseInt(primero(sp.pagina) ?? "1", 10);
  const r = await loadPublicArtworks(store.workspace.id, {
    contest: primero(sp.concurso) ?? null,
    page: Number.isFinite(pagina) ? pagina : 1,
  });

  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}/obras`;
  const enlace = (o: { contest?: string | null; page?: number }) => {
    const q = new URLSearchParams();
    if (o.contest) q.set("concurso", o.contest);
    if (o.page && o.page > 1) q.set("pagina", String(o.page));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (activo: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${
      activo
        ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
        : "border-[var(--fo-border-strong)] hover:border-[var(--fo-text)]"
    }`;
  const clave = r.contest?.key ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{r.contest ? r.contest.title : "Obras"}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
          Copias impresas de las obras de nuestros concursos. Elegí el formato en la ficha de cada obra.
        </p>
      </div>

      {r.contests.length > 1 ? (
        <nav aria-label="Concursos" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-2 pb-1">
            <li>
              <Link href={enlace({})} className={chip(!clave)} aria-current={!clave ? "page" : undefined}>
                Todos
              </Link>
            </li>
            {r.contests.map((c) => (
              <li key={c.key}>
                <Link
                  href={enlace({ contest: c.key })}
                  className={chip(clave === c.key)}
                  aria-current={clave === c.key ? "page" : undefined}
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {r.artworks.length === 0 ? (
        <div className="fo-card p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">Por ahora no hay obras a la venta.</p>
        </div>
      ) : (
        <ArtworkGrid artworks={r.artworks} basePath={base} />
      )}

      {r.totalPages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
          {r.page > 1 ? (
            <Link href={enlace({ contest: clave, page: r.page - 1 })} className="fo-btn fo-btn-secondary">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--fo-muted)]">
            Página {r.page} de {r.totalPages}
          </span>
          {r.page < r.totalPages ? (
            <Link href={enlace({ contest: clave, page: r.page + 1 })} className="fo-btn fo-btn-secondary">
              Siguientes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
