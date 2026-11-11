import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { AutoRefresco } from "@/components/en-vivo/formularios";
import { ReproductorStream } from "@/components/en-vivo/reproductor";
import { LIVE_MODULE_KEY, LIVE_PORTAL_PATH } from "@/lib/en-vivo/constantes";
import { estaActivo } from "@/lib/en-vivo/estados";
import { duracionLegible } from "@/lib/en-vivo/grabaciones";
import { cargarCanal, sesionActiva, urlDeReproduccion } from "@/lib/en-vivo/store";
import { puedeMirar } from "@/lib/en-vivo/visibilidad";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * «En vivo» del portal: la clase que se está transmitiendo ahora y las grabaciones.
 *
 * Entra sólo una persona socia ACTIVA (`loadPortalContext`, el mismo criterio de todo el portal),
 * y cada reproductor lleva un permiso firmado que vence: un enlace copiado no sirve mañana.
 */
export default async function PortalEnVivoPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const user = await requireAuth();
  const ctx = await loadPortalContext(user.id);
  if (!ctx) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(ctx.workspace.id, LIVE_MODULE_KEY))) redirect("/portal");
  const { ver } = await searchParams;

  const espectador = { tipo: "SOCIA" as const, workspaceId: ctx.workspace.id, activa: true };
  const canal = await cargarCanal(ctx.workspace.id);
  const sesion = canal ? await sesionActiva(canal.id) : null;
  const vivo =
    sesion && canal && estaActivo(sesion.status) && puedeMirar({ visibility: sesion.visibility, workspaceId: sesion.workspaceId }, espectador)
      ? sesion
      : null;
  // El reproductor de Stream sabe esperar: si OBS todavía no arrancó, muestra que empieza pronto.
  // Así no depende de que el aviso de «señal conectada» haya llegado.
  const urlVivo = vivo && canal ? urlDeReproduccion(canal.liveInputUid, { vivo: true }) : null;

  const grabaciones = await prisma.fotofficeLiveRecording.findMany({
    where: { workspaceId: ctx.workspace.id, status: "LISTA" },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      videoUid: true,
      durationSeconds: true,
      recordedAt: true,
      createdAt: true,
      session: { select: { title: true, visibility: true, workspaceId: true } },
    },
  });
  const visibles = grabaciones.filter((g) => puedeMirar(g.session, espectador));
  const elegida = visibles.find((g) => g.id === ver) ?? null;
  const urlGrabacion = elegida ? urlDeReproduccion(elegida.videoUid) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">En vivo</h1>
        <p className="max-w-2xl text-sm text-[var(--fo-muted)]">Las clases en vivo y sus grabaciones, para mirar cuando quieras.</p>
      </header>

      <section className="fo-card space-y-4 p-5">
        {vivo ? <AutoRefresco segundos={20} /> : null}
        {vivo ? (
          <>
            <h2 className="text-lg font-semibold">
              {vivo.status === "EN_VIVO" ? <span className="text-[var(--fo-danger)]">● En vivo · </span> : null}
              {vivo.title}
            </h2>
            {urlVivo ? (
              <ReproductorStream key={vivo.id} url={urlVivo} titulo={vivo.title} />
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">Está por empezar. Esta pantalla se actualiza sola.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Ahora no hay ninguna clase en vivo.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Grabaciones</h2>
        {elegida ? (
          <div className="fo-card space-y-3 p-5">
            <h3 className="font-semibold">{elegida.session.title}</h3>
            {urlGrabacion ? <ReproductorStream key={elegida.id} url={urlGrabacion} titulo={elegida.session.title} /> : null}
          </div>
        ) : null}
        {visibles.length === 0 ? (
          <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">Todavía no hay grabaciones.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visibles.map((g) => (
              <li key={g.id} className="fo-card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{g.session.title}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {FECHA.format(g.recordedAt ?? g.createdAt)}
                    {g.durationSeconds ? ` · ${duracionLegible(g.durationSeconds)}` : ""}
                  </p>
                </div>
                <Link href={`${LIVE_PORTAL_PATH}?ver=${g.id}`} className="fo-btn fo-btn-secondary text-sm">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
