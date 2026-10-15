import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { getMailingSettings } from "@/lib/mailing/settings";
import { loadMailingContext } from "@/lib/mailing/context";
import { buildCustomEmail } from "@/lib/mailing/custom-email";
import { MESSAGE_LIMITS, toArgentinaInputValue } from "@/lib/mailing/message-form";
import { MESSAGE_STATUS_LABEL } from "@/lib/mailing/constants";
import { MESSAGE_TOPIC, countMessageAudience, getMessage, metricsByCampaign } from "@/lib/mailing/messages";
import { percent } from "@/lib/mailing/webhook-events";
import { especialidadesPorGrupo } from "@/lib/membership/specialties";
import {
  approveMessageAction,
  backToDraftAction,
  deleteMessageAction,
  saveMessageAction,
  testMessageAction,
} from "@/app/actions/mailing-messages";

export const dynamic = "force-dynamic";
// «Enviar ahora» corre las tandas dentro de la acción de esta página.
export const maxDuration = 120;

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(v);

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

/** Comunicación → Campañas → una campaña. */
export default async function CampanaPage({ params, searchParams }: Props) {
  const { workspace, user } = await requireCommunicationsManager();
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMessage(workspace.id, id).catch(() => null);
  if (!m) notFound();

  const [ctx, settings, audiencia, categorias, personas] = await Promise.all([
    loadMailingContext(workspace.id),
    getMailingSettings(workspace.id),
    countMessageAudience(workspace.id, m),
    prisma.memberCategory.findMany({ where: { workspaceId: workspace.id }, select: { id: true, name: true, isActive: true }, orderBy: { order: "asc" } }),
    prisma.user.findMany({
      where: { id: { in: [m.createdByUserId, m.approvedByUserId].filter((x): x is number => x !== null) } },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const nombreDe = (uid: number | null) => {
    const p = personas.find((x) => x.id === uid);
    return p ? p.name?.trim() || p.email : "alguien";
  };

  const editable = m.status === "DRAFT";
  const vista = buildCustomEmail({
    brand: ctx.brand,
    content: m,
    vars: { nombre: "Ana", institucion: ctx.brand.name },
    signature: ctx.signature,
    footer: { reason: ctx.reason, unsubscribeUrl: ctx.unsubscribe ? ctx.unsubscribe("ejemplo@correo.com", MESSAGE_TOPIC).pageUrl : "#" },
  });

  let resumen: { sent: number; total: number; delivered: number; opened: number; clicked: number; bounced: number } | null = null;
  if (m.campaignId) {
    const [envio, met] = await Promise.all([
      prisma.fotofficeEmailCampaign.findUnique({ where: { id: m.campaignId }, select: { sentCount: true, recipientsTotal: true } }),
      metricsByCampaign([m.campaignId]),
    ]);
    const x = met.get(m.campaignId);
    if (envio) resumen = { sent: envio.sentCount, total: envio.recipientsTotal, delivered: x?.delivered ?? 0, opened: x?.opened ?? 0, clicked: x?.clicked ?? 0, bounced: x?.bounced ?? 0 };
  }

  const puedeAprobar = m.status === "PENDING_APPROVAL" && m.createdByUserId !== user.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={m.name}
        description={`Estado: ${MESSAGE_STATUS_LABEL[m.status] ?? m.status}.`}
        actions={
          <Link href="/comunicacion/campanas" className="fo-btn fo-btn-ghost text-sm">
            ← Todas las campañas
          </Link>
        }
      />
      {sp.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-alert-success p-4 text-sm">{sp.ok}</p> : null}
      {!settings.bulkEnabled ? (
        <p className="fo-alert-warning p-4 text-sm">
          Los envíos a socios están apagados: podés redactar y probar, pero no enviar hasta encenderlos en{" "}
          <Link href="/comunicacion/correo" className="underline">
            Comunicación → Correo
          </Link>
          .
        </p>
      ) : null}

      {m.status === "PENDING_APPROVAL" ? (
        <div className="fo-card space-y-3 p-5">
          <p className="text-sm text-[var(--fo-text)]">
            {nombreDe(m.createdByUserId)} pidió aprobarla{m.approvalRequestedAt ? ` el ${fecha(m.approvalRequestedAt)}` : ""}.
            {m.scheduledAt ? ` Está programada para el ${fecha(m.scheduledAt)}.` : " Al aprobarla sale en el momento."}
          </p>
          <div className="flex flex-wrap gap-2">
            {puedeAprobar ? (
              <form action={approveMessageAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="fo-btn fo-btn-primary">
                  Aprobar{m.scheduledAt ? "" : " y enviar"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">La tiene que aprobar otra persona que gestione Comunicación.</p>
            )}
            <form action={backToDraftAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="fo-btn fo-btn-secondary">
                Devolver a borrador
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {m.status === "SCHEDULED" ? (
        <div className="fo-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--fo-text)]">
            Programada para el {m.scheduledAt ? fecha(m.scheduledAt) : "—"}
            {m.approvedAt ? `. Aprobada por ${nombreDe(m.approvedByUserId)}.` : "."}
          </p>
          <form action={backToDraftAction}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" className="fo-btn fo-btn-secondary">
              Cancelar programación
            </button>
          </form>
        </div>
      ) : null}

      {resumen ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Enviados", `${resumen.sent} / ${resumen.total}`],
            ["Entregados", percent(resumen.delivered, resumen.sent)],
            ["Abiertos", percent(resumen.opened, resumen.sent)],
            ["Clics", percent(resumen.clicked, resumen.sent)],
            ["Rebotes", String(resumen.bounced)],
          ].map(([k, v]) => (
            <div key={k} className="fo-card p-4">
              <div className="text-xs text-[var(--fo-muted)]">{k}</div>
              <div className="text-lg font-semibold tabular-nums text-[var(--fo-text)]">{v}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={saveMessageAction} className="fo-card space-y-4 p-5">
          <input type="hidden" name="id" value={m.id} />
          <fieldset disabled={!editable} className="space-y-4">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="name">
                Nombre interno
              </label>
              <input id="name" name="name" className="fo-input" defaultValue={m.name} maxLength={MESSAGE_LIMITS.name} required />
              <p className="fo-helper">Para reconocerla en la lista. Los socios no lo ven.</p>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="subject">
                Asunto
              </label>
              <input id="subject" name="subject" className="fo-input" defaultValue={m.subject} maxLength={MESSAGE_LIMITS.subject} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="body">
                Texto
              </label>
              <textarea id="body" name="body" className="fo-input min-h-[240px]" defaultValue={m.body} maxLength={MESSAGE_LIMITS.body} />
              <p className="fo-helper">Dejá una línea en blanco para separar párrafos. Podés usar {"{nombre}"} y {"{institucion}"}.</p>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="imageUrl">
                Imagen (opcional)
              </label>
              <input id="imageUrl" name="imageUrl" className="fo-input" defaultValue={m.imageUrl ?? ""} placeholder="https://…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="ctaLabel">
                  Botón: texto (opcional)
                </label>
                <input id="ctaLabel" name="ctaLabel" className="fo-input" defaultValue={m.ctaLabel ?? ""} maxLength={MESSAGE_LIMITS.ctaLabel} placeholder="Inscribirme" />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="ctaUrl">
                  Botón: dirección
                </label>
                <input id="ctaUrl" name="ctaUrl" className="fo-input" defaultValue={m.ctaUrl ?? ""} placeholder="https://…" />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="fo-label">¿A quién le llega?</legend>
              <p className="fo-helper">
                Sin marcar nada, a todos los socios activos. Si marcás categorías y especialidades, tiene que cumplir las dos
                cosas. Con lo guardado le llega a <strong>{audiencia.recipients}</strong> socios
                {audiencia.optedOut ? ` (${audiencia.optedOut} se dieron de baja de las novedades)` : ""}.
              </p>
              {categorias.length > 0 ? (
                <div className="rounded-lg border border-[var(--fo-border)] p-3">
                  <div className="text-xs font-semibold text-[var(--fo-muted)]">Categoría de socio</div>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {categorias.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
                        <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={m.categoryIds.includes(c.id)} />
                        {c.name}
                        {c.isActive ? "" : " (inactiva)"}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-[var(--fo-border)] p-3">
                <div className="text-xs font-semibold text-[var(--fo-muted)]">Especialidad</div>
                {especialidadesPorGrupo().map((g) => (
                  <div key={g.id}>
                    <div className="text-xs text-[var(--fo-muted)]">{g.label}</div>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {g.items.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
                          <input type="checkbox" name="specialties" value={e.id} defaultChecked={m.specialties.includes(e.id)} />
                          {e.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="scheduledAt">
                Programar (opcional, hora argentina)
              </label>
              <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="fo-input" defaultValue={toArgentinaInputValue(m.scheduledAt)} />
              <p className="fo-helper">Vacío: sale al enviarla{settings.requireApproval ? " (o al aprobarla)" : ""}.</p>
            </div>
          </fieldset>

          {editable ? (
            <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
              <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
                <input type="checkbox" name="confirmar" value="1" />
                Revisé la prueba
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="siguiente" value="guardar" className="fo-btn fo-btn-secondary">
                  Guardar borrador
                </button>
                <button type="submit" name="siguiente" value="enviar" className="fo-btn fo-btn-primary" disabled={!settings.bulkEnabled}>
                  {settings.requireApproval ? "Guardar y pedir aprobación" : "Guardar y enviar (o programar)"}
                </button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Así lo recibe el socio</h2>
            <form action={testMessageAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Enviarme una prueba
              </button>
            </form>
          </div>
          <p className="text-xs text-[var(--fo-muted)]">
            Asunto: <strong className="text-[var(--fo-text)]">{vista.subject || "(sin asunto)"}</strong>. Vista previa con el nombre «Ana», con lo último guardado.
          </p>
          <iframe title="Vista previa del correo" srcDoc={vista.html} sandbox="" className="h-[640px] w-full rounded-lg border border-[var(--fo-border)] bg-white" />
          {editable ? (
            <form action={deleteMessageAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                Borrar borrador
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
