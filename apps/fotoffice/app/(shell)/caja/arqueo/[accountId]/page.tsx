import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCashOperator } from "@/lib/cash/access";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { expectedAmountMinor } from "@/lib/cash/shift";
import { accountBalanceMinor } from "@/lib/cash/balance";
import { userDisplayNames } from "@/lib/cash/repository";
import { ultimosConteos } from "@/lib/cash/conteos";
import { ContadorBilletes } from "../contador-billetes";

export const dynamic = "force-dynamic";

function numero(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * El contador de billetes de una caja de efectivo: la pantalla del cierre en el mostrador.
 *
 * Pensada para el teléfono o la tablet: una fila grande por billete, con + y −. Si la caja
 * tiene turno abierto, confirmar lo cierra; si no, queda como un arqueo suelto contra el
 * saldo del libro. Sólo quien opera la caja (MANAGE) llega acá: contar es operar.
 */
export default async function ArqueoPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ hecho?: string; contado?: string; pase?: string; dif?: string; aviso?: string }>;
}) {
  const { workspace } = await requireCashOperator();
  const { accountId } = await params;
  const sp = await searchParams;

  const cuenta = await prisma.cashAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id, isActive: true },
    select: { id: true, name: true, kind: true, isVault: true, fixedFloatArs: true },
  });
  if (!cuenta || cuenta.kind !== "EFECTIVO") {
    redirect(`/caja?error=${encodeURIComponent("Sólo se cuentan billetes en una caja de efectivo.")}`);
  }

  const [turno, movimientos, cajaFuerte, conteos] = await Promise.all([
    prisma.cashShift.findFirst({
      where: { workspaceId: workspace.id, accountId, status: "ABIERTO" },
      select: { id: true, openedAt: true, openingAmountArs: true },
    }),
    prisma.cashMovement.findMany({
      where: { workspaceId: workspace.id, accountId },
      select: { kind: true, amountArs: true, shiftId: true },
    }),
    cuenta.isVault
      ? Promise.resolve(null)
      : prisma.cashAccount.findFirst({
          where: { workspaceId: workspace.id, isVault: true, isActive: true, kind: "EFECTIVO", id: { not: accountId } },
          orderBy: { order: "asc" },
          select: { id: true, name: true },
        }),
    ultimosConteos(workspace.id, accountId),
  ]);
  const nombres = await userDisplayNames(conteos.map((c) => c.createdByUserId));

  const movs = movimientos.map((m) => ({
    kind: m.kind as "INGRESO" | "EGRESO",
    amountMinor: decimalArsToMinor(m.amountArs),
    shiftId: m.shiftId,
  }));
  const saldoMinor = accountBalanceMinor(movs);
  const esperadoMinor = turno
    ? expectedAmountMinor({
        openingMinor: decimalArsToMinor(turno.openingAmountArs),
        movements: movs.filter((m) => m.shiftId === turno.id),
      })
    : saldoMinor;

  // El cambio por omisión: el último que se dejó en esta caja; si nunca se contó, el fondo
  // fijo configurado en la cuenta; si tampoco hay, nada.
  const cambioInicialMinor =
    conteos[0]?.floatMinor ?? (cuenta.fixedFloatArs === null ? 0 : decimalArsToMinor(cuenta.fixedFloatArs));

  const hecho = sp.hecho === "turno" || sp.hecho === "arqueo" ? sp.hecho : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Contar billetes — ${cuenta.name}`}
        description={
          turno
            ? `Turno abierto desde el ${turno.openedAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}. Al confirmar, el turno se cierra con lo contado.`
            : cuenta.isVault
              ? "Arqueo de la caja fuerte: se compara lo contado con el saldo del libro."
              : "Esta caja no tiene turno abierto: el conteo se compara con el saldo del libro."
        }
        actions={
          <Link href="/caja" className="fo-btn fo-btn-ghost text-sm">
            Volver a Caja
          </Link>
        }
      />

      {sp.aviso ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-warning)]" role="status">
          {sp.aviso}
        </p>
      ) : null}

      {hecho ? (
        <div className="fo-card space-y-3 border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] p-5">
          <p className="text-base font-semibold text-[var(--fo-success)]">
            {hecho === "turno" ? "Turno cerrado." : "Arqueo guardado."}
          </p>
          <ul className="space-y-1 text-sm">
            <li>
              Contado: <strong>{formatMinorArs(numero(sp.contado))}</strong>
            </li>
            {numero(sp.dif) !== 0 ? (
              <li>
                {numero(sp.dif) > 0 ? "Sobrante" : "Faltante"}: <strong>{formatMinorArs(Math.abs(numero(sp.dif)))}</strong>
              </li>
            ) : null}
            {numero(sp.pase) > 0 ? (
              <li>
                Pasado a {cajaFuerte?.name ?? "la caja fuerte"}: <strong>{formatMinorArs(numero(sp.pase))}</strong>
              </li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/caja" className="fo-btn fo-btn-primary text-sm">
              Volver a Caja
            </Link>
            <Link href="/caja/turnos" className="fo-btn fo-btn-secondary text-sm">
              Ver arqueos
            </Link>
            <Link href={`/caja/arqueo/${cuenta.id}`} className="fo-btn fo-btn-ghost text-sm">
              Contar de nuevo
            </Link>
          </div>
        </div>
      ) : (
        <ContadorBilletes
          accountId={cuenta.id}
          esVault={cuenta.isVault}
          conTurno={turno !== null}
          esperadoMinor={esperadoMinor}
          cambioInicialMinor={cambioInicialMinor}
          cajaFuerteNombre={cajaFuerte?.name ?? null}
        />
      )}

      {conteos.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Últimos conteos de esta caja</h2>
          <ul className="divide-y divide-[var(--fo-border)] rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] text-sm">
            {conteos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="text-[var(--fo-muted)]">
                  {c.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                  {c.createdByUserId ? ` · ${nombres.get(c.createdByUserId) ?? "—"}` : ""}
                </span>
                <span className="tabular-nums">
                  Contado <strong>{formatMinorArs(c.countedMinor)}</strong> · cambio {formatMinorArs(c.floatMinor)} · a caja
                  fuerte {formatMinorArs(c.toVaultMinor)}
                  {c.differenceMinor ? (
                    <span className={c.differenceMinor > 0 ? " text-[var(--fo-warning)]" : " text-[var(--fo-danger)]"}>
                      {" "}
                      · {c.differenceMinor > 0 ? "sobrante" : "faltante"} {formatMinorArs(Math.abs(c.differenceMinor))}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
