import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { getDuesSettings } from "@/lib/membership/settings";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { sendDuesReminders } from "@/lib/membership/dues-reminder";
import { CommunityLinkForm, DuesSettingsForm, FeeValueForm, SendReminderButton } from "./forms";
import { getEnrollmentSettings } from "@/lib/membership/enrollment-store";
import { saveEnrollmentSettingsAction } from "@/app/actions/enrollment-settings";

export const dynamic = "force-dynamic";
/** El recordatorio manual sale de esta página: unos 100 correos con pausa entre uno y otro. */
export const maxDuration = 300;

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

/**
 * Configuración de cuotas.
 *
 * Sin un valor cargado la institución no puede cobrar nada: ni generar cuotas ni ponerle
 * precio a la tarjeta impresa. Es lo primero que hay que completar.
 */
export default async function ConfiguracionCuotasPage({
  searchParams,
}: {
  searchParams?: Promise<{ alta?: string; error?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) redirect("/members/cuotas");

  const ahora = new Date();
  const [settings, categorias, valores, vocab, previa, alta] = await Promise.all([
    getDuesSettings(workspace.id),
    prisma.memberCategory.findMany({
      where: { workspaceId: workspace.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    }),
    prisma.membershipFeeValue.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        amountArs: true,
        validFrom: true,
        validUntil: true,
        boardMinutesRef: true,
        category: { select: { name: true } },
      },
      orderBy: [{ validFrom: "desc" }],
      take: 30,
    }),
    loadPersonVocabulary(workspace.id),
    sendDuesReminders({ workspaceId: workspace.id, mode: "MANUAL", dryRun: true }),
    getEnrollmentSettings(workspace.id),
  ]);

  const hoy = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, "0")}-${String(ahora.getUTCDate()).padStart(2, "0")}`;
  const vigentes = valores.filter(
    (v) => v.validFrom <= ahora && (v.validUntil === null || v.validUntil > ahora),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuración de cuotas"
        description="Cuánto se cobra, cuándo se genera y cuándo vence."
      />

      <Link href="/members/cuotas" className="text-xs text-[var(--fo-muted)] hover:underline">
        ← Volver a Cuotas
      </Link>

      {vigentes.length === 0 ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          {/* Es el bloqueo real: sin valor no se puede cobrar nada. */}
          Todavía no hay ningún valor de cuota vigente. Hasta cargarlo no se pueden generar
          cuotas ni pedir la tarjeta impresa.
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Valor de la cuota</h2>
        <FeeValueForm categories={categorias} today={hoy} />
      </section>

      {valores.length > 0 ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Historial de valores</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fo-muted-soft)]">
                  <th className="py-2 pr-3 font-medium">Importe</th>
                  <th className="py-2 pr-3 font-medium">Categoría</th>
                  <th className="py-2 pr-3 font-medium">Rige</th>
                  <th className="py-2 font-medium">Acta</th>
                </tr>
              </thead>
              <tbody>
                {valores.map((v) => {
                  const vigente = v.validFrom <= ahora && (v.validUntil === null || v.validUntil > ahora);
                  return (
                    <tr key={v.id} className="border-t border-[var(--fo-border)]">
                      <td className="py-2.5 pr-3 font-medium tabular-nums">
                        {formatMinorArs(decimalArsToMinor(v.amountArs))}
                        {vigente ? (
                          <span className="ml-2 text-xs text-[var(--fo-success)]">vigente</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{v.category?.name ?? "Todas"}</td>
                      <td className="py-2.5 pr-3 text-xs text-[var(--fo-muted)]">
                        {fechaLegible(v.validFrom)}
                        {v.validUntil ? ` — ${fechaLegible(v.validUntil)}` : ""}
                      </td>
                      <td className="py-2.5 text-xs text-[var(--fo-muted)]">
                        {v.boardMinutesRef ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Recordatorio de cuota</h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {`Sale solo por correo el día ${settings.reminderDay} de cada mes, a las 9, a quien tenga la cuota del mes o cuotas anteriores sin pagar (la deuda anterior al sistema no se reclama). Si hay un sorteo anunciado con el padrón abierto, el correo lo cuenta: premios, logos de quien los dona y hasta cuándo hay tiempo de ponerse al día. Cada persona lo recibe una sola vez por mes.`}
        </p>
        <p className="text-sm">
          {previa.enviados === 0
            ? "Hoy no hay a quién mandárselo."
            : `Hoy le llegaría a ${previa.enviados} ${previa.enviados === 1 ? "persona" : "personas"}.`}
          {previa.yaRecordados > 0 ? ` Ya lo recibieron este mes: ${previa.yaRecordados}.` : ""}
          {previa.sinEmail > 0 ? ` Sin email cargado: ${previa.sinEmail}.` : ""}
          {previa.sorteo ? ` Incluye el sorteo «${previa.sorteo}».` : " No hay ningún sorteo anunciado para incluir."}
        </p>
        <SendReminderButton recipients={previa.enviados} />
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Alta desde el sitio</h2>
        {query.alta ? <p className="text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}
        {query.error ? <p className="text-sm text-[var(--fo-danger)]">{query.error}</p> : null}
        <form action={saveEnrollmentSettingsAction} className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="autoApproveApplications" defaultChecked={alta.autoApprove} className="mt-1" />
            <span>
              Sin aprobación: quien se asocia va directo a pagar y queda dado de alta al acreditarse.
              <span className="fo-helper block">Apagado, cada solicitud la revisa una persona.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="simpleApplicationForm" defaultChecked={alta.simpleForm} className="mt-1" />
            <span>
              Formulario corto: nombre, apellido, email y teléfono.
              <span className="fo-helper block">Para un club de clientes. Apagado, se pide el formulario completo.</span>
            </span>
          </label>
          <div className="fo-field-stack sm:max-w-xs">
            <label className="fo-label" htmlFor="applicationCategoryId">
              Categoría con la que entra
            </label>
            <select
              id="applicationCategoryId"
              name="applicationCategoryId"
              className="fo-input"
              defaultValue={alta.category?.id ?? ""}
            >
              <option value="">Según lo que declare</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
            Guardar
          </button>
        </form>
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">{`Grupo de WhatsApp de los ${vocab.plural}`}</h2>
        <CommunityLinkForm defaultUrl={settings.communityWhatsappUrl} vocabulary={vocab} />
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Calendario de cobranza</h2>
        <DuesSettingsForm
          defaults={{
            generationDay: settings.generationDay,
            dueDay: settings.dueDay,
            graceDays: settings.graceDays,
            reminderDay: settings.reminderDay,
            initialDuesCount: settings.initialDuesCount,
            recommendationEnabled: settings.recommendationEnabled,
            recommendationBenefitPercent: settings.recommendationBenefitPercent,
          }}
          vocabulary={vocab}
        />
      </section>
    </div>
  );
}
