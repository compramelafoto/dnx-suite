import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { ProbadorCuadros } from "@/components/probador/probador-cuadros";
import { cargarCatalogoProbador } from "@/lib/probador/catalogo.server";

type Props = { params: Promise<{ workspaceSlug: string }> };

async function estudio(workspaceSlug: string) {
  return prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const nombre = (await estudio((await params).workspaceSlug))?.commercialName;
  if (!nombre) return {};
  return {
    title: `Probador de cuadros · ${nombre}`,
    description: `Sacale una foto a tu pared y mirá cómo quedan tus cuadros, dípticos y trípticos de ${nombre}, a escala real.`,
  };
}

/**
 * El probador de cuadros de cada estudio. No depende de ningún módulo ni lee datos del cliente:
 * las fotos se procesan en el navegador. Los precios salen del catálogo de Ventas del estudio
 * (`cargarCatalogoProbador`). Cómo entra al menú: ver `PUBLIC_MODULE_PAGES` y
 * `OPTIONAL_PUBLIC_PAGES`.
 */
export default async function ProbadorDeCuadrosPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const branding = await estudio(workspaceSlug);
  if (!branding) notFound();
  const catalogo = await cargarCatalogoProbador(branding.workspaceId);

  return (
    // El aire de arriba deja lugar al encabezado de los diseños que lo superponen a la página.
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-10 pt-28 md:px-8 md:pb-14 md:pt-32">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Probador de cuadros</h1>
        <p className="max-w-2xl opacity-80">
          Sacale una foto a tu pared, marcá una medida que conozcas y mirá cómo quedan los cuadros a escala real:
          individuales, dípticos, trípticos o una galería, con el marco que elijas.
        </p>
      </header>
      <ProbadorCuadros catalogo={catalogo} />
    </main>
  );
}
