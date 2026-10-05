import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { listMessages, metricsByCampaign } from "@/lib/mailing/messages";
import { MESSAGE_STATUS_LABEL } from "@/lib/mailing/constants";
import { percent } from "@/lib/mailing/webhook-events";
import { prisma } from "@repo/db";
import { createMessageAction } from "@/app/actions/mailing-messages";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(v);

function esTablaAusente(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:table|relation|column).*does not exist|P2021|P2022/i.test(message);
}

/** Comunicación → Campañas. Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapa-4-campanas-design.md */
export default async function CampanasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace } = await requireCommunicationsManager();
  const sp = await searchParams;

  let faltaMigracion = false;
  let mensajes: Awaited<ReturnType<typeof listMessages>> = [];
  try {
    mensajes = await listMessages(workspace.id);
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }
  const campaignIds = mensajes.map((m) => m.campaignId).filter((x): x is string => Boolean(x));
  const [metricas, envios] = await Promise.all([
    metricsByCampaign(campaignIds).catch(() => new Map()),
    campaignIds.length
      ? prisma.fotofficeEmailCampaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, sentCount: true, recipientsTotal: true } })
      : Promise.resolve([]),
  ]);
  const envioPorId = new Map(envios.map((e) => [e.id, e]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campañas"
        description="Correos propios de la institución: una invitación, una asamblea, una convocatoria. A todos los socios o a una parte, ahora o programados."
        actions={
          <form action={createMessageAction}>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Nueva campaña
            </button>
          </form>
        }
      />
      {sp.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-alert-success p-4 text-sm">{sp.ok}</p> : null}
      {faltaMigracion ? (
        <p className="fo-alert-warning p-4 text-sm">Falta preparar la base de datos para las campañas. Avisale al equipo técnico.</p>
      ) : null}

      {mensajes.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay campañas. Creá la primera con «Nueva campaña».</p>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Campaña</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 text-right font-medium">Enviados</th>
                <th className="px-4 py-2 text-right font-medium">Abiertos</th>
                <th className="px-4 py-2 text-right font-medium">Clics</th>
              </tr>
            </thead>
            <tbody>
              {mensajes.map((m) => {
                const envio = m.campaignId ? envioPorId.get(m.campaignId) : null;
                const met = m.campaignId ? metricas.get(m.campaignId) : null;
                const cuando =
                  m.status === "SENT" && m.sentAt
                    ? `Enviada el ${fecha(m.sentAt)}`
                    : m.status === "SCHEDULED" && m.scheduledAt
                      ? `Sale el ${fecha(m.scheduledAt)}`
                      : `Creada el ${fecha(m.createdAt)}`;
                return (
                  <tr key={m.id} className="border-t border-[var(--fo-border)]">
                    <td className="px-4 py-2">
                      <Link href={`/comunicacion/campanas/${m.id}`} className="font-medium text-[var(--fo-text)] hover:underline">
                        {m.name}
                      </Link>
                      <div className="text-xs text-[var(--fo-muted)]">{m.subject || "Sin asunto"} · {cuando}</div>
                    </td>
                    <td className="px-4 py-2">{MESSAGE_STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{envio ? `${envio.sentCount} / ${envio.recipientsTotal}` : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{envio && met ? percent(met.opened, envio.sentCount) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{envio && met ? percent(met.clicked, envio.sentCount) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[var(--fo-muted)]">
        Las aperturas y los clics los informa el servicio de correo: son aproximados (algunos programas de correo no avisan
        cuando se abre un mensaje).
      </p>
    </div>
  );
}
