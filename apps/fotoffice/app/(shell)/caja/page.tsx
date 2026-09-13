import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { listAccounts, listCategories, movementsOfShift, openShiftFor } from "@/lib/cash/repository";
import { expectedAmountMinor } from "@/lib/cash/shift";
import { listClients } from "@/lib/clients/repository";
import { openShiftAction } from "./actions";
import { ShiftPanel } from "./shift-panel";

export const dynamic = "force-dynamic";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireCashStaff();
  const params = await searchParams;

  const cuentas = await listAccounts(workspace.id);
  // Sólo el efectivo de mostrador lleva turno: la caja fuerte y lo digital se cuentan o se
  // concilian de otra manera. Ver `canOpenShift`.
  const cuentasDeMostrador = cuentas.filter((c) => c.kind === "EFECTIVO" && !c.isVault);

  if (cuentasDeMostrador.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Caja" description="El turno abierto: lo que entró y salió desde que se abrió." />
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay ninguna cuenta de efectivo de mostrador. Configurala en Cuentas y
            categorías antes de abrir un turno.
          </p>
          <Link href="/caja/configuracion" className="fo-btn fo-btn-primary text-sm">
            Ir a configuración
          </Link>
        </div>
      </div>
    );
  }

  const [categorias, clientes] = await Promise.all([
    listCategories(workspace.id),
    listClients(workspace.id),
  ]);

  const paneles = await Promise.all(
    cuentasDeMostrador.map(async (cuenta) => {
      const turno = await openShiftFor(workspace.id, cuenta.id);
      if (!turno) return { cuenta, turno: null, movimientos: [], expectedMinor: 0 };
      const movimientos = await movementsOfShift(workspace.id, turno.id);
      const expectedMinor = expectedAmountMinor({
        openingMinor: turno.openingAmountMinor,
        movements: movimientos.map((m) => ({ kind: m.kind, amountMinor: m.amountMinor })),
      });
      return { cuenta, turno, movimientos, expectedMinor };
    }),
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Caja" description="El turno abierto: lo que entró y salió desde que se abrió." />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      <div className="space-y-6">
        {paneles.map(({ cuenta, turno, movimientos, expectedMinor }) =>
          turno ? (
            <ShiftPanel
              key={cuenta.id}
              shift={turno}
              accountName={cuenta.name}
              expectedMinor={expectedMinor}
              movements={movimientos}
              categories={categorias}
              clients={clientes}
            />
          ) : (
            <section key={cuenta.id} className="fo-card space-y-4 p-5">
              <h2 className="text-base font-semibold">{cuenta.name}</h2>
              <p className="text-sm text-[var(--fo-muted)]">Sin turno abierto.</p>
              <form action={openShiftAction} className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="accountId" value={cuenta.id} />
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor={`apertura-${cuenta.id}`}>
                    Con cuánto abrís
                  </label>
                  <input
                    id={`apertura-${cuenta.id}`}
                    name="openingAmountArs"
                    className="fo-input"
                    placeholder="20.000"
                    required
                  />
                </div>
                <div className="self-end">
                  <button type="submit" className="fo-btn fo-btn-primary text-sm">
                    Abrir turno
                  </button>
                </div>
              </form>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
