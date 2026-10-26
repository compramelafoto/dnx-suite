import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listarCategoriasPublicas, listarTrabajosPublicos } from "@/lib/trabajos/publico";
import { cargarSitioDeTrabajos, metadataDeTrabajos, trabajosPath } from "@/lib/trabajos/paginas.server";
import { numeroDePagina, totalDePaginas, TRABAJOS_POR_PAGINA } from "@/lib/trabajos/sitio-publico";
import { TrabajosListado } from "@/components/website/render/trabajos/trabajos-listado";

type Props = {
  params: Promise<{ workspaceSlug: string; categoria: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** La categoría pedida, sólo si está visible (una oculta da 404, igual que sus trabajos). */
async function cargar(workspaceSlug: string, categoriaSlug: string) {
  const site = await cargarSitioDeTrabajos(workspaceSlug);
  if (!site) return null;
  const categorias = await listarCategoriasPublicas(site.workspaceId);
  const categoria = categorias.find((c) => c.slug === categoriaSlug);
  return categoria ? { site, categorias, categoria } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, categoria } = await params;
  const data = await cargar(workspaceSlug, categoria);
  if (!data) return { title: "Trabajos", robots: { index: false, follow: false } };
  return metadataDeTrabajos(data.site, {
    title: `${data.categoria.nombre} · Trabajos`,
    description: `Trabajos de ${data.site.commercialName} en ${data.categoria.nombre}.`,
    path: `${trabajosPath(data.site.workspaceSlug)}/${data.categoria.slug}`,
    imageUrl: data.categoria.portadaUrl,
  });
}

export default async function TrabajosCategoriaPage({ params, searchParams }: Props) {
  const { workspaceSlug, categoria: categoriaSlug } = await params;
  const data = await cargar(workspaceSlug, categoriaSlug);
  if (!data) notFound();
  const { site, categorias, categoria } = data;

  const pagina = numeroDePagina((await searchParams).pagina);
  const { trabajos, total } = await listarTrabajosPublicos(site.workspaceId, {
    categoriaSlug: categoria.slug,
    limite: TRABAJOS_POR_PAGINA,
    pagina,
    base: `/w/${site.workspaceSlug}`,
  });
  if (pagina > 1 && trabajos.length === 0) notFound();

  return (
    <TrabajosListado
      base={trabajosPath(site.workspaceSlug)}
      nombreSitio={site.commercialName}
      categorias={categorias}
      categoriaActiva={categoria}
      trabajos={trabajos}
      pagina={pagina}
      totalPaginas={totalDePaginas(total)}
    />
  );
}
