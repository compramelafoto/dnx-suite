import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CarpetaPublica } from "@/components/carpetas/carpeta-publica";
import { abrirCarpeta } from "@/lib/carpetas/carpeta";
import { ofertaPublica } from "@/lib/impresiones/configuracion-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Es privada: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Archivos del pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** La carpeta de un trabajo, por su enlace privado: el laboratorio descarga, el cliente mira y descarga. */
export default async function CarpetaPublicaPage({ params }: { params: Promise<{ workspaceSlug: string; token: string }> }) {
  const { workspaceSlug, token } = await params;
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const vista = await abrirCarpeta(workspaceId, token);
  if (!vista) notFound();
  // Pedir copias: sólo el cliente (no el laboratorio) y si el estudio tiene la impresión encendida y con precios.
  const imprimir = vista.audiencia === "CLIENTE" && (await ofertaPublica(workspaceId)) !== null;
  const enlaceImprimir = imprimir ? `/w/${workspaceSlug}/archivos/${encodeURIComponent(token)}/imprimir` : undefined;
  return <CarpetaPublica vista={vista} enlaceImprimir={enlaceImprimir} />;
}
