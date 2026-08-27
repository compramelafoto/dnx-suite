import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getDuesSettings } from "@/lib/membership/settings";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { DuesSettingsForm, FeeValueForm } from "./forms";

export const dynamic = "force-dynamic";

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
export default async function ConfiguracionCuotasPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) redirect("/members/cuotas");

  const ahora = new Date();
  const [settings, categorias, valores] = await Promise.all([
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

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Calendario de cobranza</h2>
        <DuesSettingsForm
          defaults={{
            generationDay: settings.generationDay,
            dueDay: settings.dueDay,
            graceDays: settings.graceDays,
            reminderDay: settings.reminderDay,
            initialDuesCount: settings.initialDuesCount,
          }}
        />
      </section>
    </div>
  );
}
