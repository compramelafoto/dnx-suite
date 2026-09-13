import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireClientsStaff } from "@/lib/clients/access";
import { listClients } from "@/lib/clients/repository";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspace } = await requireClientsStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;

  const clientes = await listClients(workspace.id, { search: q });
  const sinClientes = clientes.length === 0 && !q;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Padrón de clientes del negocio: ficha, contacto y datos fiscales."
        actions={
          <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
            Nuevo cliente
          </Link>
        }
      />

      {sinClientes ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay clientes cargados</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Cargá el primero con su nombre, su contacto y —si hace falta facturarle— sus
              datos fiscales.
            </p>
          </div>
          <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
            Crear el primer cliente
          </Link>
        </div>
      ) : (
        <>
          <form method="GET" className="fo-card flex flex-wrap items-end gap-3 !p-4">
            <div className="fo-field-stack min-w-[240px] flex-1">
              <label className="fo-label" htmlFor="q">
                Buscar
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q ?? ""}
                className="fo-input"
                placeholder="Nombre, razón social, documento, correo o teléfono"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">
                Buscar
              </button>
              {q ? (
                <Link href="/clientes" className="fo-btn fo-btn-ghost min-h-10 text-sm">
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          {clientes.length === 0 ? (
            <div className="fo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium">Ningún cliente coincide con esa búsqueda.</p>
              <Link href="/clientes" className="fo-btn fo-btn-secondary text-sm">
                Ver todos los clientes
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">N°</th>
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Documento</th>
                    <th className="px-4 py-3 font-semibold">Contacto</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="w-16 px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--fo-muted)]">
                        {c.clientNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fo-text)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{c.displayName}</span>
                          {c.memberNumber ? (
                            <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                              Socio {c.memberNumber}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--fo-muted)]">{c.docNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--fo-muted)]">
                        {c.email ?? c.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fo-muted)]">
                        {c.status === "ACTIVO" ? "Activo" : "Inactivo"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="font-medium text-[var(--fo-accent)] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
