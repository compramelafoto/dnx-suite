import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { listShifts, userDisplayNames } from "@/lib/cash/repository";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { suggestedDropMinor } from "@/lib/cash/transfer";
import { transferAction } from "../actions";

export const dynamic = "force-dynamic";

function fecha(d: Date) {
  return d.toLocaleString("es-AR");
}

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; shiftId?: string }>;
}) {
  const { workspace } = await requireCashStaff();
  const params = await searchParams;

  const turnos = await listShifts(workspace.id);
  const nombres = await userDisplayNames(turnos.flatMap((t) => [t.openedByUserId, t.closedByUserId]));

  // El pase al cerrar, el gesto de todos los días: se propone acá porque `closeShiftAction`
  // redirige a esta pantalla, no a `/caja`. Sólo se ofrece cuando el negocio tiene una caja
  // fuerte a la que pasar — si no existe, no hay a dónde.
  const cajaFuerte =
    params.ok === "1"
      ? await prisma.cashAccount.findFirst({
          where: { workspaceId: workspace.id, isVault: true, isActive: true },
          select: { id: true, name: true },
        })
      : null;
  // Atado al turno concreto que `closeShiftAction` acaba de cerrar (viaja en `shiftId` por la
  // URL de redirect), no al "arqueo cerrado más reciente" por fecha: con dos cajas cerrando
  // casi al mismo tiempo —dos sucursales, o dos cuentas— lo más reciente por fecha puede ser
  // el turno de OTRA cuenta, y se propondría pasar el importe equivocado. El `workspaceId` en
  // el `where` verifica de paso que el turno referenciado sea del workspace activo.
  const cierreReciente =
    cajaFuerte && params.shiftId
      ? await prisma.cashShift.findFirst({
          where: { id: params.shiftId, workspaceId: workspace.id, status: "CERRADO" },
          select: {
            id: true,
            accountId: true,
            countedAmountArs: true,
            account: { select: { name: true, fixedFloatArs: true } },
          },
        })
      : null;

  const propuestaDePase =
    cierreReciente && cajaFuerte && cierreReciente.accountId !== cajaFuerte.id
      ? (() => {
          const countedMinor =
            cierreReciente.countedAmountArs === null ? 0 : decimalArsToMinor(cierreReciente.countedAmountArs);
          const fixedFloatMinor =
            cierreReciente.account.fixedFloatArs === null ? 0 : decimalArsToMinor(cierreReciente.account.fixedFloatArs);
          return {
            shiftId: cierreReciente.id,
            fromAccountId: cierreReciente.accountId,
            fromAccountName: cierreReciente.account.name,
            toAccountId: cajaFuerte.id,
            toAccountName: cajaFuerte.name,
            countedMinor,
            fixedFloatMinor,
            suggestedMinor: suggestedDropMinor({ countedMinor, fixedFloatMinor }),
          };
        })()
      : null;

  return (
    <div className="space-y-8">
      <PageHeader title="Arqueos" description="Cada apertura y cierre de turno, con su diferencia y su explicación." />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok && !propuestaDePase ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Turno cerrado.</p>
      ) : null}

      {propuestaDePase ? (
        <div className="fo-card space-y-4 p-5">
          <p className="text-sm">
            Contaste <strong>{formatMinorArs(propuestaDePase.countedMinor)}</strong> en {propuestaDePase.fromAccountName}.
            El fondo fijo de esa caja es <strong>{formatMinorArs(propuestaDePase.fixedFloatMinor)}</strong>.
          </p>
          <form action={transferAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="fromAccountId" value={propuestaDePase.fromAccountId} />
            <input type="hidden" name="toAccountId" value={propuestaDePase.toAccountId} />
            <input type="hidden" name="fromShiftId" value={propuestaDePase.shiftId} />
            <input type="hidden" name="note" value="Pase de cierre de turno" />
            <input type="hidden" name="returnTo" value="/caja/turnos" />
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="pase-amount">
                ¿Pasás cuánto a {propuestaDePase.toAccountName}?
              </label>
              <input
                id="pase-amount"
                name="amountArs"
                className="fo-input"
                defaultValue={formatMinorArs(propuestaDePase.suggestedMinor).replace("$", "").trim()}
              />
            </div>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Sí, pasar
            </button>
            <a href="/caja/turnos" className="fo-btn fo-btn-ghost text-sm">
              Ahora no
            </a>
          </form>
        </div>
      ) : null}

      {turnos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no se abrió ningún turno.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Cuenta</th>
                <th className="px-4 py-3 font-semibold">Abierto</th>
                <th className="px-4 py-3 font-semibold">Abrió</th>
                <th className="px-4 py-3 font-semibold">Cerró</th>
                <th className="px-4 py-3 text-right font-semibold">Esperado</th>
                <th className="px-4 py-3 text-right font-semibold">Contado</th>
                <th className="px-4 py-3 text-right font-semibold">Diferencia</th>
                <th className="px-4 py-3 font-semibold">Explicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {turnos.map((t) => {
                const conDiferencia = t.differenceMinor !== null && t.differenceMinor !== 0;
                return (
                  <tr key={t.id} className={conDiferencia ? "bg-[var(--fo-danger)]/5" : undefined}>
                    <td className="px-4 py-3 font-medium">{t.accountName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--fo-muted)]">{fecha(t.openedAt)}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">
                      {t.openedByUserId ? (nombres.get(t.openedByUserId) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">
                      {t.status === "ABIERTO" ? "Sigue abierto" : t.closedByUserId ? (nombres.get(t.closedByUserId) ?? "—") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {t.expectedAmountMinor === null ? "—" : formatMinorArs(t.expectedAmountMinor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {t.countedAmountMinor === null ? "—" : formatMinorArs(t.countedAmountMinor)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                        conDiferencia ? "text-[var(--fo-danger)]" : ""
                      }`}
                    >
                      {t.differenceMinor === null ? "—" : formatMinorArs(t.differenceMinor)}
                    </td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{t.differenceNote ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
