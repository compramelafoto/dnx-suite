import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { getMailingSettings } from "@/lib/mailing/settings";
import { loadAudience } from "@/lib/mailing/campaigns";
import { CAMPAIGN_KIND_LABEL, CAMPAIGN_STATUS_LABEL } from "@/lib/mailing/constants";
import { setMailingSwitchAction } from "@/app/actions/mailing";
import { metricsByCampaign } from "@/lib/mailing/messages";
import { percent } from "@/lib/mailing/webhook-events";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

function esTablaAusente(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:table|relation).*does not exist|P2021/i.test(message);
}

/**
 * Comunicación → Correo. Los interruptores de los correos a socios y el historial de envíos.
 * Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapas-1-2-design.md
 */
export default async function CorreoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace } = await requireCommunicationsManager();
  const params = await searchParams;

  const [sender, settings] = await Promise.all([loadWorkspaceSender(workspace.id), getMailingSettings(workspace.id)]);

  let faltaMigracion = false;
  let audiencia = { recipients: [] as unknown[], optedOut: 0 };
  let envios: Awaited<ReturnType<typeof listarEnvios>> = [];
  try {
    [audiencia, envios] = await Promise.all([loadAudience(workspace.id, "blog"), listarEnvios(workspace.id)]);
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }
  const metricas = await metricsByCampaign(envios.map((e) => e.id)).catch(() => new Map());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Correo a socios"
        description="Los correos que la institución les manda a sus socios: artículos del blog, resumen semanal, fechas y saludos, y campañas propias."
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-alert-success p-4 text-sm">{params.ok}</p> : null}
      {faltaMigracion ? (
        <p className="fo-alert-warning p-4 text-sm">
          Falta preparar la base de datos para los envíos. Avisale al equipo técnico.
        </p>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Quién figura como remitente</h2>
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Los socios ven los correos como enviados por{" "}
          <strong className="text-[var(--fo-text)]">{sender.name ?? workspace.name}</strong>.{" "}
          {sender.replyTo ? (
            <>
              Si responden, la respuesta le llega a <strong className="text-[var(--fo-text)]">{sender.replyTo}</strong>.
            </>
          ) : (
            <>No hay correo de contacto cargado: si un socio responde, la respuesta no le llega a la institución.</>
          )}
        </p>
        <p className="text-xs text-[var(--fo-muted)]">
          El nombre es el nombre comercial y la casilla de respuestas es el correo de contacto; los dos se cambian en
          Configuración de la institución. Vale para todos los correos, también los de cuotas, reservas e inscripciones.
        </p>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Envíos a socios</h2>
        <p className="text-sm text-[var(--fo-text-secondary)]">
          {audiencia.recipients.length} socios activos con correo los recibirían
          {audiencia.optedOut > 0 ? ` (${audiencia.optedOut} se dieron de baja de las novedades)` : ""}. Cada correo lleva
          un enlace para darse de baja.
        </p>
        <Interruptor
          campo="bulkEnabled"
          encendido={settings.bulkEnabled}
          titulo="Permitir envíos a los socios"
          detalle="Apagado, el botón «Enviar a socios» del blog sólo manda pruebas a quien lo aprieta. Es la llave de seguridad de todo lo demás."
        />
        <Interruptor
          campo="weeklyBlogDigest"
          encendido={settings.weeklyBlogDigest}
          titulo="Resumen semanal del blog"
          detalle="Los lunes a las 9 sale un correo con los artículos de la semana que no se mandaron solos. Si no hubo artículos nuevos, no sale nada."
        />
        <Interruptor
          campo="requireApproval"
          encendido={settings.requireApproval}
          titulo="Las campañas necesitan aprobación"
          detalle="Una campaña de Comunicación → Campañas no sale hasta que la apruebe otra persona que gestione Comunicación (no quien la escribió)."
        />
        <p className="text-xs text-[var(--fo-muted)]">
          Para mandar un artículo, abrilo en Sitio web → Blog: cuando está publicado aparece la tarjeta «Enviar a socios
          por email».
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Historial</h2>
        {envios.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se mandó ningún correo a los socios.</p>
        ) : (
          <div className="fo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Correo</th>
                  <th className="px-4 py-2 text-right font-medium">Enviados</th>
                  <th className="px-4 py-2 text-right font-medium">Abiertos</th>
                  <th className="px-4 py-2 text-right font-medium">Clics</th>
                  <th className="px-4 py-2 text-right font-medium">Fallidos</th>
                  <th className="px-4 py-2 text-right font-medium">Bajas</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--fo-border)]">
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--fo-text-secondary)]">{fecha(e.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="text-[var(--fo-text)]">{e.subject}</div>
                      <div className="text-xs text-[var(--fo-muted)]">{CAMPAIGN_KIND_LABEL[e.kind] ?? e.kind}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {e.sentCount} / {e.recipientsTotal}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{percent(metricas.get(e.id)?.opened ?? 0, e.sentCount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{percent(metricas.get(e.id)?.clicked ?? 0, e.sentCount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{e.failedCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{e.optedOutCount}</td>
                    <td className="px-4 py-2">{CAMPAIGN_STATUS_LABEL[e.status] ?? e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function listarEnvios(workspaceId: string) {
  return prisma.fotofficeEmailCampaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      subject: true,
      status: true,
      recipientsTotal: true,
      sentCount: true,
      failedCount: true,
      optedOutCount: true,
      createdAt: true,
    },
  });
}

function Interruptor(props: { campo: string; encendido: boolean; titulo: string; detalle: string }) {
  return (
    <form
      action={setMailingSwitchAction}
      className="flex flex-col gap-3 rounded-lg border border-[var(--fo-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <input type="hidden" name="campo" value={props.campo} />
      <input type="hidden" name="valor" value={props.encendido ? "0" : "1"} />
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--fo-text)]">
          {props.titulo}
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              props.encendido
                ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]"
                : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
            }`}
          >
            {props.encendido ? "Encendido" : "Apagado"}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--fo-muted)]">{props.detalle}</p>
      </div>
      <button type="submit" className={`fo-btn ${props.encendido ? "fo-btn-secondary" : "fo-btn-primary"} shrink-0`}>
        {props.encendido ? "Apagar" : "Encender"}
      </button>
    </form>
  );
}
