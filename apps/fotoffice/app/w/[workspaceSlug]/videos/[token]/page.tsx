import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaVideos } from "@/components/digitalizacion/pagina-videos";
import { leerFranjas } from "@/lib/digitalizacion/entrega";
import { MENSAJES_CARGOS } from "@/lib/digitalizacion/servidor/cargos";
import { abrirEntregaPublica } from "@/lib/digitalizacion/servidor/videos-publicos";
import { coordenadasDelEstudio, envioParaNavegador } from "@/lib/impresiones/envio";
import { pasaElFrenoDeEnlaces } from "@/lib/pedidos/freno-publico";
import { extrasDelWorkspace } from "@/lib/presupuestos/perfil-cobro";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** El aviso de un cargo que no se pudo pedir (`?cargo=error&motivo=`): sólo códigos conocidos. */
function avisoDeCargo(cargo: unknown, motivo: unknown): string | null {
  if (cargo !== "error") return null;
  if (typeof motivo === "string" && Object.hasOwn(MENSAJES_CARGOS, motivo)) return MENSAJES_CARGOS[motivo as keyof typeof MENSAJES_CARGOS];
  return MENSAJES_CARGOS.fallo;
}

export async function generateMetadata(): Promise<Metadata> {
  // Es del cliente: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Tus videos", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * La página de videos del cliente (spec 2026-10-22, E4), sin sesión: el token es la llave. Con
 * saldo pendiente no se muestran ni se firman los videos. Vencida o borrada: lo dice. Token sin
 * forma, desconocido, renovado o de otro workspace: "Enlace no disponible" (404).
 */
export default async function VideosPublicosPage({ params, searchParams }: Props) {
  const { workspaceSlug, token } = await params;
  const q = await searchParams;
  if (!(await pasaElFrenoDeEnlaces())) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const vista = await abrirEntregaPublica(workspaceId, token);
  if (!vista) notFound();
  const aviso = avisoDeCargo(q.cargo, q.motivo);
  // Para mostrar el precio del envío mientras se elige la dirección (informativo): el estudio
  // redondeado a ~100 m y las franjas. El que vale lo calcula el servidor al pedirlo.
  const [extras, ajustes] = vista.envio.puedePedir
    ? await Promise.all([
        extrasDelWorkspace(workspaceId).catch(() => null),
        prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { enviosFranjas: true } }),
      ])
    : [null, null];
  const estudio = coordenadasDelEstudio(extras);
  const estudioNavegador = estudio ? envioParaNavegador({ estudio })!.estudio : null;
  return (
    <PaginaVideos
      modo="PUBLICA"
      vista={vista}
      slug={workspaceSlug}
      token={token}
      aviso={aviso}
      estudio={estudioNavegador}
      franjas={leerFranjas(ajustes?.enviosFranjas ?? null)}
    />
  );
}
