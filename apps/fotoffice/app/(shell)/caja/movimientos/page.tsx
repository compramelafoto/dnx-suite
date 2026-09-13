import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { listAccounts, listCategories, listMovements } from "@/lib/cash/repository";
import { listClients } from "@/lib/clients/repository";
import { MOVEMENT_KINDS, type MovementKind } from "@/lib/cash/constants";
import { MovementsTable } from "../movements-table";
import { MovementForm } from "../movement-form";

export const dynamic = "force-dynamic";

const ETIQUETA_KIND: Record<MovementKind, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };

/** El fin del día incluido: "hasta el 10" tiene que traer también lo cargado el 10. */
function finDelDia(ymd: string): Date {
  const d = new Date(`${ymd}T23:59:59.999`);
  return d;
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    categoryId?: string;
    kind?: string;
    clientId?: string;
    from?: string;
    to?: string;
    error?: string;
    ok?: string;
  }>;
}) {
  const { workspace } = await requireCashStaff();
  const sp = await searchParams;

  const kindValido = sp.kind && MOVEMENT_KINDS.includes(sp.kind as MovementKind) ? (sp.kind as MovementKind) : undefined;

  const [cuentas, categorias, clientes, movimientos] = await Promise.all([
    listAccounts(workspace.id),
    listCategories(workspace.id),
    listClients(workspace.id),
    listMovements(workspace.id, {
      accountId: sp.accountId || undefined,
      categoryId: sp.categoryId || undefined,
      clientId: sp.clientId || undefined,
      kind: kindValido,
      from: sp.from ? new Date(`${sp.from}T00:00:00`) : undefined,
      to: sp.to ? finDelDia(sp.to) : undefined,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Movimientos" description="El libro completo, con lo que entró y salió de todas las cuentas." />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      {/*
        La carga manual con selector de cuenta vive acá y no en `/caja`: es el único lugar de
        la interfaz donde anotar un movimiento en una cuenta sin panel de turno —Mercado
        Pago, el banco, la caja fuerte—. Sin esto, una transferencia recibida no tendría
        dónde quedar registrada, que es justo lo que este módulo existe para evitar. El botón
        "Nuevo movimiento" del mostrador (dentro de `ShiftPanel`, en `/caja`) no se toca: es
        el gesto rápido del día a día y sigue con la cuenta fija.
      */}
      <MovementForm accounts={cuentas} categories={categorias} clients={clientes} />

      <form method="GET" className="fo-card grid gap-4 !p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="from">
            Desde
          </label>
          <input id="from" name="from" type="date" className="fo-input" defaultValue={sp.from ?? ""} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="to">
            Hasta
          </label>
          <input id="to" name="to" type="date" className="fo-input" defaultValue={sp.to ?? ""} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="accountId">
            Cuenta
          </label>
          <select id="accountId" name="accountId" className="fo-input" defaultValue={sp.accountId ?? ""}>
            <option value="">Todas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="categoryId">
            Categoría
          </label>
          <select id="categoryId" name="categoryId" className="fo-input" defaultValue={sp.categoryId ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({ETIQUETA_KIND[c.kind]})
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="kind">
            Tipo
          </label>
          <select id="kind" name="kind" className="fo-input" defaultValue={sp.kind ?? ""}>
            <option value="">Todos</option>
            {MOVEMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ETIQUETA_KIND[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="clientId">
            Cliente
          </label>
          <select id="clientId" name="clientId" className="fo-input" defaultValue={sp.clientId ?? ""}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 lg:col-span-6">
          <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">
            Filtrar
          </button>
          <a href="/caja/movimientos" className="fo-btn fo-btn-ghost min-h-10 text-sm">
            Limpiar
          </a>
        </div>
      </form>

      <MovementsTable movements={movimientos} showAccount showReverseAction />
    </div>
  );
}
