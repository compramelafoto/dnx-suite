import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import {
  listAccounts,
  listCategories,
  listMovements,
  movementsForBalance,
  movementsOfShift,
  openShiftFor,
  type OpenShiftRow,
} from "@/lib/cash/repository";
import { balancesByAccountMinor } from "@/lib/cash/balance";
import { expectedAmountMinor } from "@/lib/cash/shift";
import { listClients } from "@/lib/clients/repository";
import { AccountCard } from "./account-card";
import { MovementForm } from "./movement-form";
import { MovementsTable } from "./movements-table";

export const dynamic = "force-dynamic";

/** Cuántos movimientos recientes mostrar en el panorama: una foto, no el libro completo. */
const MOVIMIENTOS_RECIENTES = 20;

/**
 * El panorama del módulo: el saldo de cada cuenta, lo último que entró y salió de todas
 * juntas, y un lugar único para cargar un movimiento nuevo.
 *
 * Antes esta pantalla ERA el turno abierto del mostrador, y si no había cuenta de efectivo
 * configurada mostraba un cartel de "configurá antes de abrir un turno" — como si abrir
 * turno fuera un paso obligatorio para poder cobrar. No lo es: `createMovementAction` nunca
 * exigió un turno, sólo la pantalla lo insinuaba. Por eso el turno bajó a ser un bloque más
 * dentro de la tarjeta de SU cuenta (`AccountCard` + `ShiftBlock`), y esta pantalla sirve
 * por igual a la sociedad que sólo cobra por Mercado Pago, al estudio con caja diaria y caja
 * fuerte, y a todo lo que haya entre las dos, sin que nadie tenga que reconfigurar nada.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, role } = await requireCashStaff();
  const params = await searchParams;

  const cuentas = await listAccounts(workspace.id);

  if (cuentas.length === 0) {
    // `/caja/configuracion` es ADMIN+ (`requireCashAdmin`) y rebota a `/caja` para cualquier
    // otro rol. Ofrecerle el botón a un STAFF sin ese permiso era un callejón sin salida: lo
    // clickeaba y volvía a esta misma pantalla vacía. El control de verdad sigue siendo el
    // servidor en `lib/cash/access.ts` — esto es sólo no mostrar un camino cerrado.
    const puedeConfigurar = canManageWorkspaceSettings(role);
    return (
      <div className="space-y-8">
        <PageHeader
          title="Caja"
          description="Saldo por cuenta, lo último que entró y salió, y el turno de cada mostrador."
        />
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            {puedeConfigurar
              ? "Todavía no hay ninguna cuenta configurada. Creá las tuyas en Cuentas y categorías —caja diaria, caja fuerte, Mercado Pago o lo que uses— para empezar a cargar movimientos."
              : "Todavía no hay ninguna cuenta configurada. Pedile a un administrador que las cree en Cuentas y categorías."}
          </p>
          {puedeConfigurar ? (
            <Link href="/caja/configuracion" className="fo-btn fo-btn-primary text-sm">
              Ir a configuración
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const [categorias, clientes, movimientosRecientes, movimientosParaSaldo] = await Promise.all([
    listCategories(workspace.id),
    listClients(workspace.id),
    listMovements(workspace.id, { take: MOVIMIENTOS_RECIENTES }),
    movementsForBalance(workspace.id),
  ]);

  const saldos = balancesByAccountMinor(
    cuentas.map((c) => c.id),
    movimientosParaSaldo,
  );

  // Sólo el efectivo de mostrador puede tener turno (`canOpenShift`, en `lib/cash/shift.ts`):
  // a la caja fuerte y a lo digital ni les preguntamos.
  const cuentasDeMostrador = cuentas.filter((c) => c.kind === "EFECTIVO" && !c.isVault);
  const turnosPorCuenta = new Map<string, { turno: OpenShiftRow | null; expectedMinor: number }>(
    await Promise.all(
      cuentasDeMostrador.map(async (cuenta) => {
        const turno = await openShiftFor(workspace.id, cuenta.id);
        if (!turno) return [cuenta.id, { turno: null, expectedMinor: 0 }] as const;
        const movimientosDelTurno = await movementsOfShift(workspace.id, turno.id);
        const expectedMinor = expectedAmountMinor({
          openingMinor: turno.openingAmountMinor,
          movements: movimientosDelTurno.map((m) => ({ kind: m.kind, amountMinor: m.amountMinor })),
        });
        return [cuenta.id, { turno, expectedMinor }] as const;
      }),
    ),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Caja"
        description="Saldo por cuenta, lo último que entró y salió, y el turno de cada mostrador."
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      {/*
        Siempre disponible y con selector de cuenta: cargar un ingreso o pagar algo no puede
        depender de que haya un turno abierto en ninguna cuenta, ni hoy ni en ningún otro
        camino de la interfaz.
      */}
      <MovementForm accounts={cuentas} categories={categorias} clients={clientes} returnTo="/caja" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cuentas.map((cuenta) => {
          const info = turnosPorCuenta.get(cuenta.id);
          return (
            <AccountCard
              key={cuenta.id}
              cuenta={cuenta}
              balanceMinor={saldos.get(cuenta.id) ?? 0}
              turno={info?.turno ?? null}
              expectedMinor={info?.expectedMinor ?? 0}
            />
          );
        })}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Últimos movimientos</h2>
        <MovementsTable movements={movimientosRecientes} showAccount />
      </div>
    </div>
  );
}
