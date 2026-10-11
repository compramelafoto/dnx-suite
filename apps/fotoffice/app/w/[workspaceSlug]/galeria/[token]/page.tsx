import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GaleriaCliente } from "@/components/galeria-publica/galeria-cliente";
import { armarVistaGaleria, registrarEntrada, resolverTokenGaleria } from "@/lib/galerias/publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { abreAlguienDelEquipo, visitanteDelEnlace } from "./visitante";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es personal del cliente: no se indexa, y la dirección (que lleva el token) no se manda a ningún sitio
  // que se abra desde acá. El encabezado HTTP lo pone `next.config.ts`.
  return { title: "Tu galería", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * El enlace de una galería (etapa 7), sin sesión: el token es la llave y es personal de cada cliente.
 * Enlace desconocido, de otra organización, anulado o de una galería que no está publicada: el mismo
 * "Este enlace ya no es válido" (404). La primera apertura deja `firstSeenAt` y el evento; si lo abre
 * alguien del equipo no cuenta.
 */
export default async function GaleriaPublicaPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDelEnlace();
  if (!visitante.permitido) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) notFound();
  if (!(await abreAlguienDelEquipo(workspaceId))) await registrarEntrada(r);
  const vista = await armarVistaGaleria(r);
  return <GaleriaCliente slug={workspaceSlug} token={token} vista={vista} />;
}
