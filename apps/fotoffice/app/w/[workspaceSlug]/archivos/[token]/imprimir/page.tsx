import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PedidoCliente } from "@/components/impresiones/pedido-cliente";
import { ofertaPublica } from "@/lib/impresiones/configuracion-servidor";
import { envioParaNavegador } from "@/lib/impresiones/envio";
import { resolverFuente } from "@/lib/impresiones/fuentes-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { iniciarPagoImpresionAction } from "./actions";

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
  const [fuente, oferta, branding] = await Promise.all([
    resolverFuente(workspaceId, workspaceSlug, "CARPETA", token),
    ofertaPublica(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }),
  ]);
  if (!fuente || !oferta) notFound();

  return (
    <PedidoCliente
      // La clave del original no viaja al navegador.
      fuente={{ tipo: fuente.tipo, fotos: fuente.fotos.map((f) => ({ id: f.id, nombre: f.nombre, mini: f.mini, width: f.width, height: f.height })) }}
      pagar={iniciarPagoImpresionAction.bind(null, workspaceSlug, token)}
      estudio={branding?.commercialName?.trim() || "el estudio"}
      volver={{ href: `/w/${workspaceSlug}/archivos/${token}`, texto: "Tus archivos" }}
      // El costo del laboratorio no viaja al navegador.
      tamanos={oferta.tamanos.map((t) => ({ id: t.id, widthCm: t.widthCm, heightCm: t.heightCm, priceCents: t.priceCents }))}
      papeles={oferta.papeles}
      // La ubicación del estudio va redondeada: el envío que vale lo calcula el servidor con el punto exacto.
      envio={envioParaNavegador(oferta.envio)}
      cliente={{ nombre: fuente.nombre ?? "", email: fuente.email ?? "", telefono: fuente.telefono ?? "" }}
      plazo="dentro de 48 horas hábiles desde el pago"
    />
  );
}
