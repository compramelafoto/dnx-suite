import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireStoreConfigurer } from "@/lib/store/access";
import { loadContestCatalog } from "@/lib/store/artworks/catalog";
import { parseCatalogFilter, royaltyPercentText, type CatalogFilter } from "@/lib/store/artworks/catalog-rules";
import { EntriesTable } from "./entries-table";
import { OrphanListings } from "./orphan-listings";
import { RoyaltyForm } from "./royalty-form";

export const dynamic = "force-dynamic";

const FILTROS: { filter: CatalogFilter; label: string }[] = [
  { filter: "todas", label: "Todas" },
  { filter: "premiadas", label: "Premiadas" },
  { filter: "finalistas", label: "Finalistas" },
];

function href(contestId: string, filter: CatalogFilter, page = 1) {
  const q = new URLSearchParams();
  if (filter !== "todas") q.set("filtro", filter);
  if (page > 1) q.set("pagina", String(page));
  const s = q.toString();
  return `/ventas/tienda/obras/${contestId}${s ? `?${s}` : ""}`;
}

/**
 * Un concurso de una organización vinculada: la regalía para sus autores y sus obras, para
 * avisar o pedir permiso a los autores y publicarlas en la tienda.
 */
export default async function TiendaObrasConcursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ filtro?: string; pagina?: string }>;
}) {
  const { workspace } = await requireStoreConfigurer();
  const { contestId } = await params;
  const sp = await searchParams;
  const filter = parseCatalogFilter(sp.filtro);
  const catalogo = await loadContestCatalog(workspace.id, contestId, { filter, page: Number(sp.pagina ?? "1") });
  if (!catalogo) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={catalogo.contest.title}
        description="Elegí qué obras vender. Antes de publicar una, avisale al autor (si las bases que aceptó ya lo permiten) o pedile permiso."
      />
      <p className="text-sm">
        <Link href="/ventas/tienda/obras" className="underline">
          ← Volver a Obras
        </Link>
      </p>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Regalía para los autores</h2>
          <p className="fo-helper">
            Porcentaje del precio de cada copia o cuadro vendido (sin el envío) que le corresponde al autor de la obra. Se
            informa en el correo que reciben los autores.
          </p>
        </div>
        <RoyaltyForm contestId={catalogo.contest.id} percent={royaltyPercentText(catalogo.royaltyBps)} />
      </section>

      {catalogo.orphans.length > 0 ? <OrphanListings contestId={catalogo.contest.id} rows={catalogo.orphans} /> : null}

      <section className="space-y-4">
        <nav className="flex flex-wrap gap-2" aria-label="Filtros">
          {FILTROS.map((f) => {
            const activa = f.filter === filter;
            return (
              <Link
                key={f.filter}
                href={href(catalogo.contest.id, f.filter)}
                aria-current={activa ? "page" : undefined}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm ${
                  activa
                    ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-medium text-[var(--fo-text)]"
                    : "border-[var(--fo-border)] text-[var(--fo-text)]"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {catalogo.rows.length === 0 ? (
          <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">
            {filter === "todas" ? "Este concurso no tiene obras confirmadas." : "No hay obras con este filtro."}
          </div>
        ) : (
          // La clave reinicia la selección al cambiar de página o filtro: "Avisar / pedir permiso"
          // sólo manda a las obras elegidas que se están viendo.
          <EntriesTable key={`${filter}-${catalogo.page}`} contestId={catalogo.contest.id} rows={catalogo.rows} />
        )}

        {catalogo.totalPages > 1 ? (
          <nav className="flex items-center justify-between text-sm" aria-label="Páginas">
            <span className="text-[var(--fo-muted)]">
              {catalogo.total} obras · página {catalogo.page} de {catalogo.totalPages}
            </span>
            <span className="flex gap-3">
              {catalogo.page > 1 ? (
                <Link className="underline" href={href(catalogo.contest.id, filter, catalogo.page - 1)}>
                  ← Anterior
                </Link>
              ) : null}
              {catalogo.page < catalogo.totalPages ? (
                <Link className="underline" href={href(catalogo.contest.id, filter, catalogo.page + 1)}>
                  Siguiente →
                </Link>
              ) : null}
            </span>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
