import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { loadDuesOverview } from "@/lib/membership/dues-overview";
import { formatMinorArs } from "@/lib/membership/money";
import { periodOf } from "@/lib/membership/monthly-plan";
import { GenerateDuesButton } from "./generate-button";

export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** `2026-08` → `agosto de 2026`. Sin `Intl`: el resultado no debe depender del servidor. */
function periodoLegible(period: string): string {
  const [anio, mes] = period.split("-");
  const indice = Number(mes) - 1;
  if (!anio || Number.isNaN(indice) || indice < 0 || indice > 11) return period;
  return `${MESES[indice]} de ${anio}`;
}

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

const ESTADO_TEXTO: Record<string, { texto: string; clase: string }> = {
  ACREDITADO: { texto: "Acreditado", clase: "text-[var(--fo-success)]" },
  PENDIENTE: { texto: "Pendiente", clase: "text-[var(--fo-muted)]" },
  RECHAZADO: { texto: "Rechazado", clase: "text-[var(--fo-danger)]" },
};

/**
 * Estado de cobranza de la institución.
 *
 * Responde dos preguntas distintas y no las mezcla: **quién debe** y **qué entró**. Juntarlas
 * en una sola lista obliga a leerla dos veces para contestar cualquiera de las dos.
 */
export default async function CuotasPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const puedeVer = await canManageWorkspaceCollection(user.id, workspace.id);
  if (!puedeVer) redirect("/members");

  const [overview, cobros] = await Promise.all([
    loadDuesOverview(workspace.id),
    getWorkspaceCollectionStatus(workspace.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuotas"
        description="Quién debe, qué entró y cuánto se cobró."
      />

      <div className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Generar cuotas</h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Crea la cuota del mes para cada socio activo, según su categoría y su escala.
          Correrlo de nuevo no duplica nada.
        </p>
        <GenerateDuesButton defaultPeriod={periodOf(new Date())} />
        <Link href="/members/cuotas/configuracion" className="text-xs text-[var(--fo-muted)] hover:underline">
          Valores y calendario →
        </Link>
      </div>

      <div className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Pagos anteriores al sistema</h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Cargá por planilla el registro de cobros previo a FotoOffice para que cada socio vea
          su historial completo en el portal. No da de alta socios ni modifica ninguna deuda.
        </p>
        <Link href="/members/cuotas/historial" className="fo-btn fo-btn-secondary inline-flex text-sm">
          Importar pagos anteriores
        </Link>
      </div>

      {!cobros.canCharge ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          El cobro en línea no está habilitado, así que los socios no pueden pagar desde el
          portal.{" "}
          <Link href="/workspace/configuracion/cobros" className="underline">
            Configurar cobros
          </Link>
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="fo-card space-y-1 p-4">
          <p className="text-xs text-[var(--fo-muted-soft)]">Deuda total</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatMinorArs(overview.totalDebtMinor)}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            {overview.debtors.length === 1
              ? "1 socio con saldo"
              : `${overview.debtors.length} socios con saldo`}
          </p>
        </div>
        <div className="fo-card space-y-1 p-4">
          <p className="text-xs text-[var(--fo-muted-soft)]">Cobrado en 30 días</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--fo-success)]">
            {formatMinorArs(overview.collectedLast30Minor)}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">Solo pagos acreditados</p>
        </div>
        <div className="fo-card space-y-1 p-4">
          <p className="text-xs text-[var(--fo-muted-soft)]">Pagos pendientes</p>
          <p className="text-xl font-semibold tabular-nums">{overview.pendingCount}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            {/* No se los da por perdidos: el efectivo tarda hasta 48 horas. */}
            Se revisan solos cada hora
          </p>
        </div>
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Socios con saldo</h2>
        {overview.debtors.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Nadie debe cuotas. Toda la institución está al día.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fo-muted-soft)]">
                  <th className="py-2 pr-3 font-medium">Socio</th>
                  <th className="py-2 pr-3 font-medium">Desde</th>
                  <th className="py-2 pr-3 font-medium">Cuotas</th>
                  <th className="py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {overview.debtors.map((d) => (
                  <tr key={d.memberId} className="border-t border-[var(--fo-border)]">
                    <td className="py-2.5 pr-3">
                      <Link href={`/members/${d.memberId}`} className="hover:underline">
                        {d.fullName}
                      </Link>
                      <span className="block text-xs text-[var(--fo-muted-soft)]">
                        N° {d.memberNumber}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--fo-muted)]">
                      {periodoLegible(d.oldestPeriod)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {d.openCharges}
                      {d.overdueCharges > 0 ? (
                        <span className="text-[var(--fo-danger)]">
                          {" "}
                          ({d.overdueCharges} vencida{d.overdueCharges === 1 ? "" : "s"})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums">
                      {formatMinorArs(d.totalDueMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Últimos pagos</h2>
        {overview.recentPayments.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no entró ningún pago.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fo-muted-soft)]">
                  <th className="py-2 pr-3 font-medium">Socio</th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 text-right font-medium">Cobrado</th>
                  <th className="py-2 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentPayments.map((p) => {
                  const estado = ESTADO_TEXTO[p.status] ?? {
                    texto: p.status,
                    clase: "text-[var(--fo-muted)]",
                  };
                  return (
                    <tr key={p.id} className="border-t border-[var(--fo-border)]">
                      <td className="py-2.5 pr-3">
                        {p.fullName}
                        <span className="block text-xs text-[var(--fo-muted-soft)]">
                          N° {p.memberNumber}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-[var(--fo-muted)]">
                        {fechaLegible(p.paidAt ?? p.createdAt)}
                      </td>
                      <td className={`py-2.5 pr-3 text-xs ${estado.clase}`}>{estado.texto}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatMinorArs(p.amountMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatMinorArs(p.netMinor)}
                        <span className="block text-xs text-[var(--fo-muted-soft)]">
                          {/* Que la diferencia se vea es deliberado: la institución tiene que
                              saber cuánto retuvo la plataforma, no descubrirlo después. */}
                          −{formatMinorArs(p.feeMinor)} de comisión
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          El neto es lo que entra a la cuenta de la institución. Aparte de la comisión de la
          plataforma, MercadoPago descuenta la suya y los impuestos que correspondan.
        </p>
      </section>
    </div>
  );
}
