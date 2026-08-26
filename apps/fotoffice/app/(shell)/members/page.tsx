import Link from "next/link";
import { countMembersByStatus, listMemberCategories, searchMembers } from "@repo/db/fotoffice-members";
import { requireMembersContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { MEMBER_STATUS_LABELS, isMemberStatus } from "@/lib/members/status-labels";
import { Users } from "lucide-react";

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; page?: string }>;
}) {
  const { workspace, canManage } = await requireMembersContext();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status && isMemberStatus(sp.status) ? sp.status : undefined;
  const categoryId = sp.categoryId || undefined;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const [result, counts, categories] = await Promise.all([
    searchMembers(workspace.id, { search: q, status, categoryId, page }),
    countMembersByStatus(workspace.id),
    listMemberCategories(workspace.id),
  ]);

  const hasFilters = Boolean(q || status || categoryId);
  const noMembersAtAll = counts.total === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Socios"
        description="Padrón de socios de este workspace: alta, edición, categorías y estado."
        actions={
          canManage ? (
            <>
              <Link href="/members/categories" className="fo-btn fo-btn-secondary text-sm">
                Categorías
              </Link>
              <Link href="/members/import" className="fo-btn fo-btn-secondary text-sm">
                Importar socios
              </Link>
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                Nuevo socio
              </Link>
            </>
          ) : undefined
        }
      />

      {noMembersAtAll ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay socios cargados</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {categories.length === 0
                ? "Primero creá al menos una categoría de socio, después vas a poder cargar socios."
                : "Cargá el primer socio del padrón de este workspace."}
            </p>
          </div>
          {canManage ? (
            categories.length === 0 ? (
              <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm">
                Crear primera categoría
              </Link>
            ) : (
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                Agregar primer socio
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Total</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.total}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Activos</p>
              <p className="text-2xl font-semibold text-[var(--fo-success)] mt-1">{counts.ACTIVE}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Suspendidos</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.SUSPENDED}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Inactivos</p>
              <p className="text-2xl font-semibold text-[var(--fo-muted)] mt-1">{counts.INACTIVE}</p>
            </div>
          </div>

          <form method="GET" className="fo-card !p-4 flex flex-wrap items-end gap-3">
            <div className="fo-field-stack flex-1 min-w-[220px]">
              <label className="fo-label" htmlFor="q">
                Buscar
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q ?? ""}
                className="fo-input"
                placeholder="Nombre, apellido, número, email o documento"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="categoryId">
                Categoría
              </label>
              <select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""} className="fo-input">
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="status">
                Estado
              </label>
              <select id="status" name="status" defaultValue={status ?? ""} className="fo-input">
                <option value="">Todos</option>
                {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="fo-btn fo-btn-primary text-sm min-h-10">
                Buscar
              </button>
              {hasFilters ? (
                <Link href="/members" className="fo-btn fo-btn-ghost text-sm min-h-10">
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          {result.items.length === 0 ? (
            <div className="fo-card flex flex-col items-center text-center py-12 px-6 gap-3">
              <p className="text-sm font-medium text-[var(--fo-text)]">
                Ningún socio coincide con esa búsqueda.
              </p>
              <Link href="/members" className="fo-btn fo-btn-secondary text-sm">
                Ver todos los socios
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
                <table className="w-full text-sm text-left min-w-[860px]">
                  <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">N°</th>
                      <th className="px-4 py-3 font-semibold">Apellido y nombre</th>
                      <th className="px-4 py-3 font-semibold">Categoría</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Teléfono</th>
                      <th className="px-4 py-3 font-semibold">Ingreso</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                    {result.items.map((m) => (
                      <tr key={m.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                        <td className="px-4 py-3 text-[var(--fo-muted)] font-mono text-xs">
                          {m.memberNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--fo-text)]">
                          {m.lastName}, {m.firstName}
                        </td>
                        <td className="px-4 py-3 text-[var(--fo-muted)]">{m.category?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--fo-muted)]">{m.email ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--fo-muted)]">{m.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--fo-muted)] whitespace-nowrap">
                          {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(m.joinedAt)}
                        </td>
                        <td className="px-4 py-3 text-[var(--fo-muted)]">
                          {MEMBER_STATUS_LABELS[m.status]}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/members/${m.id}`}
                            className="text-[var(--fo-accent)] font-medium hover:underline"
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.pageCount > 1 ? (
                <div className="flex items-center justify-between text-sm text-[var(--fo-muted)]">
                  <p>
                    Página {result.page} de {result.pageCount} — {result.total} socios
                  </p>
                  <div className="flex gap-2">
                    {result.page > 1 ? (
                      <Link
                        href={`/members${buildQuery({ q, status, categoryId }, { page: String(result.page - 1) })}`}
                        className="fo-btn fo-btn-secondary text-sm min-h-9"
                      >
                        Anterior
                      </Link>
                    ) : null}
                    {result.page < result.pageCount ? (
                      <Link
                        href={`/members${buildQuery({ q, status, categoryId }, { page: String(result.page + 1) })}`}
                        className="fo-btn fo-btn-secondary text-sm min-h-9"
                      >
                        Siguiente
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
