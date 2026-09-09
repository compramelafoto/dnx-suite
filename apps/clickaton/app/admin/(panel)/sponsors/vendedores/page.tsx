import { listSalesAgents } from "@repo/db/partners-sales-agents";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  cambiarEstadoVendedorAction,
  guardarVendedorAction,
} from "@/lib/admin/partners/sales-agents-mutations";

export const dynamic = "force-dynamic";

/**
 * Quién puede vender inventario, y hasta dónde.
 *
 * Sin una fila acá, una organización solo vende lo suyo. Habilitarla a ofrecer
 * la red es una decisión comercial de DNX, por eso vive en este panel.
 */

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function AdminVendedoresPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const aviso = (await searchParams) ?? {};

  const resultado = await withClickatonDb(() => listSalesAgents());

  if (!resultado.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Vendedores habilitados"
          description="Quién puede ofrecer inventario publicitario, y hasta dónde."
          breadcrumbs={[{ label: "Sponsors y beneficios" }, { label: "Vendedores" }]}
        />
        <AdminMigrationNotice message={resultado.message} />
      </div>
    );
  }

  const vendedores = resultado.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Vendedores habilitados"
        description="Cualquier organización vende su propio inventario sin figurar acá. Esta lista es para las que además pueden ofrecer los espacios globales de la red."
        breadcrumbs={[{ label: "Sponsors y beneficios" }, { label: "Vendedores" }]}
      />

      {aviso.ok ? (
        <div className="rounded-lg border border-ck-border bg-ck-surface px-4 py-3 text-sm text-ck-text">
          {aviso.ok}
        </div>
      ) : null}
      {aviso.error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {aviso.error}
        </div>
      ) : null}

      <Card variant="outlined" className="p-5">
        <h2 className="mb-1 text-base font-semibold text-ck-text">Habilitar un vendedor</h2>
        <p className="mb-4 text-sm text-ck-text-muted">
          Si la organización ya estaba habilitada, se actualizan sus datos en lugar de duplicarla.
        </p>
        <form action={guardarVendedorAction} className="grid gap-4 md:grid-cols-2">
          <Field
            id="vend-org"
            label="Identificador de la organización"
            hint="El mismo que se guarda como «quién trajo la venta»."
          >
            <Input type="text" name="organizationId" placeholder="ws_sfpr / org cuid…" required />
          </Field>

          <Field id="vend-nombre" label="Nombre visible">
            <Input type="text" name="displayName" placeholder="SFPR" required />
          </Field>

          <Field id="vend-notas" label="Notas">
            <Input type="text" name="notes" placeholder="Opcional" />
          </Field>

          <label className="flex items-start gap-2.5 self-end pb-1 text-sm text-ck-text">
            <input type="checkbox" name="canSellPlatform" className="mt-1" />
            <span>
              Puede ofrecer los espacios globales de la red
              <span className="block text-xs text-ck-text-muted">
                Sin esto solo vende su propio concurso, evento o portal.
              </span>
            </span>
          </label>

          <div className="md:col-span-2">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Card>

      {vendedores.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay vendedores habilitados"
          description="Hoy solo DNX ofrece los espacios de la red."
        />
      ) : (
        <Card variant="outlined" className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-ck-border text-left text-xs uppercase tracking-wide text-ck-text-muted">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Alcance</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id} className="border-b border-ck-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ck-text">{v.displayName}</div>
                    <div className="text-xs text-ck-text-muted">{v.organizationId}</div>
                    {v.notes ? (
                      <div className="mt-1 text-xs text-ck-text-muted">{v.notes}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {v.canSellPlatform ? (
                      <Badge variant="brand">Su inventario y la red</Badge>
                    ) : (
                      <Badge variant="neutral">Solo su inventario</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.status === "ACTIVE" ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="neutral">Suspendido</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={cambiarEstadoVendedorAction}>
                      <input type="hidden" name="organizationId" value={v.organizationId} />
                      <input
                        type="hidden"
                        name="suspender"
                        value={v.status === "ACTIVE" ? "true" : "false"}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        {v.status === "ACTIVE" ? "Suspender" : "Reactivar"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
