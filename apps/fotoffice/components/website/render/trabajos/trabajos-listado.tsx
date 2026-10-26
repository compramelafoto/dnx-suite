import Link from "next/link";
import type { CategoriaPublica, TrabajoTarjeta } from "@/lib/trabajos/publico";
import { BlogChips, BlogEmpty, BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import { TrabajosGrilla } from "./trabajos-grilla";

/**
 * El listado público de Trabajos: todos (`/trabajos`) o los de una categoría
 * (`/trabajos/<categoria>`). Mismo marco y mismas pastillas que el blog, así el sitio se ve uno.
 */
export function TrabajosListado({
  base,
  nombreSitio,
  categorias,
  categoriaActiva,
  trabajos,
  pagina,
  totalPaginas,
}: {
  /** `/w/<slug>/trabajos`. */
  base: string;
  nombreSitio: string;
  categorias: CategoriaPublica[];
  categoriaActiva: CategoriaPublica | null;
  trabajos: TrabajoTarjeta[];
  pagina: number;
  totalPaginas: number;
}) {
  const chips = [
    { href: base, label: "Todos", active: categoriaActiva === null },
    ...categorias.map((c) => ({ href: `${base}/${c.slug}`, label: c.nombre, active: c.slug === categoriaActiva?.slug })),
  ];
  const aqui = categoriaActiva ? `${base}/${categoriaActiva.slug}` : base;
  const enlacePagina = (n: number) => (n <= 1 ? aqui : `${aqui}?pagina=${n}`);

  return (
    <BlogFrame>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 md:space-y-14">
        <div className="space-y-6">
          <BlogListHeader
            eyebrow="Trabajos"
            title={categoriaActiva ? categoriaActiva.nombre : `Trabajos de ${nombreSitio}`}
            description={categoriaActiva ? `Trabajos de ${nombreSitio} en ${categoriaActiva.nombre}.` : null}
          />
          <BlogChips label="Categorías de trabajos" chips={chips} />
        </div>

        {trabajos.length > 0 ? <TrabajosGrilla trabajos={trabajos} /> : <BlogEmpty>Todavía no hay trabajos publicados.</BlogEmpty>}

        {totalPaginas > 1 ? (
          <nav aria-label="Páginas" className="flex items-center justify-between border-t pt-8 text-sm" style={{ borderColor: BLOG_SOFT_BORDER }}>
            {pagina > 1 ? (
              <Link href={enlacePagina(pagina - 1)} rel="prev" className="font-semibold" style={{ color: "var(--wsite-primary)" }}>
                ← Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span style={{ opacity: 0.65 }}>
              Página {pagina} de {totalPaginas}
            </span>
            {pagina < totalPaginas ? (
              <Link href={enlacePagina(pagina + 1)} rel="next" className="font-semibold" style={{ color: "var(--wsite-primary)" }}>
                Siguientes →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </BlogFrame>
  );
}
