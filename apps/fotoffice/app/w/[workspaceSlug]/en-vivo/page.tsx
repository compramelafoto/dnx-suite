import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { AutoRefresco } from "@/components/en-vivo/formularios";
import { ReproductorStream } from "@/components/en-vivo/reproductor";
import { LIVE_MODULE_KEY } from "@/lib/en-vivo/constantes";
import { cargarCanal, sesionActiva, urlDeReproduccion } from "@/lib/en-vivo/store";
import { puedeMirar } from "@/lib/en-vivo/visibilidad";

export const dynamic = "force-dynamic";

/**
 * `/w/<institución>/en-vivo`: el vivo PÚBLICO de ahora, sin sesión. Un vivo sólo para personas
 * socias no se muestra acá (ni se dice que existe): para eso está el portal.
 *
 * Las grabaciones públicas no se listan acá todavía (etapa futura, ver el diseño).
 */
export default async function EnVivoPublicoPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, LIVE_MODULE_KEY))) notFound();

  const canal = await cargarCanal(branding.workspaceId);
  const sesion = canal ? await sesionActiva(canal.id) : null;
  const vivo =
    sesion && puedeMirar({ visibility: sesion.visibility, workspaceId: sesion.workspaceId }, { tipo: "ANONIMO" }) ? sesion : null;
  // El reproductor de Stream espera solo si OBS todavía no arrancó: no depende de los avisos.
  const url = vivo && canal ? urlDeReproduccion(canal.liveInputUid, { vivo: true }) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">En vivo</h1>
      {vivo ? <AutoRefresco segundos={20} /> : null}
      {vivo ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {vivo.status === "EN_VIVO" ? <span className="text-[var(--fo-danger)]">● En vivo · </span> : null}
            {vivo.title}
          </h2>
          {url ? (
            <ReproductorStream key={vivo.id} url={url} titulo={vivo.title} />
          ) : (
            <p className="text-[var(--fo-muted)]">Está por empezar. Esta página se actualiza sola.</p>
          )}
        </section>
      ) : (
        <p className="text-[var(--fo-muted)]">Ahora no hay ninguna transmisión en vivo.</p>
      )}
    </main>
  );
}
