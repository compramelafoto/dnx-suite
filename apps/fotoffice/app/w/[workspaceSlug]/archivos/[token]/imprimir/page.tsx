import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { ofertaPublica } from "@/lib/impresiones/configuracion-servidor";
import { fotosAptas, proyectoDeTokenCliente } from "@/lib/impresiones/fuentes-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { PedidoCliente } from "./pedido-cliente";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Es privada como la carpeta: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Pedir copias impresas", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Pedir copias impresas de las fotos de la carpeta, desde el enlace del CLIENTE (no el del laboratorio). */
export default async function ImprimirPage({ params }: { params: Promise<{ workspaceSlug: string; token: string }> }) {
  const { workspaceSlug, token } = await params;
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const [proyecto, oferta] = await Promise.all([proyectoDeTokenCliente(workspaceId, token), ofertaPublica(workspaceId)]);
  if (!proyecto || !oferta) notFound();
  const [fotos, cliente, branding] = await Promise.all([
    fotosAptas(workspaceId, proyecto.proyectoId),
    proyecto.clientId
      ? prisma.client.findFirst({
          where: { id: proyecto.clientId, workspaceId },
          select: { firstName: true, lastName: true, businessName: true, email: true, phone: true },
        })
      : null,
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }),
  ]);
  const nombre = [cliente?.firstName, cliente?.lastName].filter(Boolean).join(" ") || cliente?.businessName?.trim() || "";

  return (
    <PedidoCliente
      slug={workspaceSlug}
      token={token}
      estudio={branding?.commercialName?.trim() || "el estudio"}
      carpeta={`/w/${workspaceSlug}/archivos/${token}`}
      fotos={fotos.map((f) => ({
        archivoId: f.archivoId,
        nombre: f.nombre,
        mini: `/api/w/${workspaceSlug}/archivos/${token}/mini/${f.archivoId}`,
        width: f.width,
        height: f.height,
      }))}
      // El costo del laboratorio no viaja al navegador.
      tamanos={oferta.tamanos.map((t) => ({ id: t.id, widthCm: t.widthCm, heightCm: t.heightCm, priceCents: t.priceCents }))}
      papeles={oferta.papeles}
      cliente={{ nombre, email: cliente?.email ?? "", telefono: cliente?.phone ?? "" }}
      plazo="dentro de 48 horas hábiles desde el pago"
    />
  );
}
