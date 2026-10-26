import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listarCategoriasPublicas, listarTrabajosPublicos } from "@/lib/trabajos/publico";
import { cargarSitioDeTrabajos, metadataDeTrabajos, trabajosPath } from "@/lib/trabajos/paginas.server";
import { numeroDePagina, totalDePaginas, TRABAJOS_POR_PAGINA } from "@/lib/trabajos/sitio-publico";
import { TrabajosListado } from "@/components/website/render/trabajos/trabajos-listado";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const site = await cargarSitioDeTrabajos(workspaceSlug);
  if (!site) return { title: "Trabajos" };
  return metadataDeTrabajos(site, {
    title: "Trabajos",
    description: `Trabajos fotográficos de ${site.commercialName}.`,
    path: trabajosPath(site.workspaceSlug),
  });
}

/**
 * Los trabajos publicados de la institución, de a 24, con las categorías visibles como filtro.
 * Vive dentro del sitio, bajo el mismo encabezado y pie que la portada. Si las tablas de Trabajos
 * todavía no existen (el SQL se aplica a mano), las lecturas devuelven vacío: la página dice que
 * no hay trabajos, nunca da error.
 */
export default async function TrabajosPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const site = await cargarSitioDeTrabajos(workspaceSlug);
  if (!site) notFound();

  const pagina = numeroDePagina((await searchParams).pagina);
  const base = trabajosPath(site.workspaceSlug);
  const [categorias, { trabajos, total }] = await Promise.all([
    listarCategoriasPublicas(site.workspaceId),
    listarTrabajosPublicos(site.workspaceId, { limite: TRABAJOS_POR_PAGINA, pagina, base: `/w/${site.workspaceSlug}` }),
  ]);
  // Una página más allá de la última no existe (la primera sí, aunque esté vacía).
  if (pagina > 1 && trabajos.length === 0) notFound();

  return (
    <TrabajosListado
      base={base}
      nombreSitio={site.commercialName}
      categorias={categorias}
      categoriaActiva={null}
      trabajos={trabajos}
      pagina={pagina}
      totalPaginas={totalDePaginas(total)}
    />
  );
}
