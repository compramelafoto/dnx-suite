import Link from "next/link";
import { requireBlogEditor } from "@/lib/blog/access";
import { listarCategorias, listarTrabajos } from "@/lib/trabajos/repositorio";
import { TRABAJOS_ADMIN_BASE, esTablaFaltante, fechaLarga } from "@/lib/trabajos/reglas";
import { AvisoTablasFaltantes, TrabajosShell } from "@/components/website/trabajos/trabajos-shell";
import { NuevoTrabajo } from "@/components/website/trabajos/nuevo-trabajo";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ categoria?: string; estado?: string }> };

const ESTADOS: Record<string, { label: string; clase: string }> = {
  PUBLICADO: {
    label: "Publicado",
    clase: "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
  },
  BORRADOR: {
    label: "Borrador",
    clase: "bg-[var(--fo-border-muted)] text-[var(--fo-muted)] border-[var(--fo-border)]",
  },
};

async function cargar(workspaceId: string, filtro: { categoriaId?: string; estado?: string }) {
  try {
    const [trabajos, categorias] = await Promise.all([listarTrabajos(workspaceId, filtro), listarCategorias(workspaceId)]);
    return { trabajos, categorias, faltanTablas: false };
  } catch (err) {
    if (esTablaFaltante(err)) return { trabajos: [], categorias: [], faltanTablas: true };
    throw err;
  }
}

export default async function TrabajosPage({ searchParams }: Props) {
  const { workspace } = await requireBlogEditor();
  const params = await searchParams;
  // Un estado inventado en la dirección se ignora en vez de dar una lista vacía sin explicación.
  const estado = params.estado && params.estado in ESTADOS ? params.estado : undefined;
  const categoriaId = params.categoria?.trim() || undefined;
  const { trabajos, categorias, faltanTablas } = await cargar(workspace.id, { categoriaId, estado });
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c]));
  const filtrando = Boolean(estado || categoriaId);

  if (faltanTablas) {
    return (
      <TrabajosShell>
        <AvisoTablasFaltantes />
      </TrabajosShell>
    );
  }

  return (
    <TrabajosShell>
      <div className="space-y-4">
        <NuevoTrabajo categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))} />

        <form className="fo-card grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" role="search">
          <label className="block">
            <span className="fo-label">Categoría</span>
            <select name="categoria" defaultValue={categoriaId ?? ""} className="fo-input">
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.visible ? "" : " (oculta)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="fo-label">Estado</span>
            <select name="estado" defaultValue={estado ?? ""} className="fo-input">
              <option value="">Todos</option>
              <option value="PUBLICADO">Publicados</option>
              <option value="BORRADOR">Borradores</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-secondary">
              Filtrar
            </button>
            {filtrando ? (
              <Link href={TRABAJOS_ADMIN_BASE} className="fo-btn fo-btn-ghost">
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>

        {trabajos.length === 0 ? (
          <div className="fo-card py-12 text-center">
            {filtrando ? (
              <p className="text-sm text-[var(--fo-muted)]">Ningún trabajo coincide con el filtro.</p>
            ) : (
              <>
                <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay trabajos</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--fo-muted)]">
                  Creá el primero con su título, subí las fotos y publicalo. Para que se vea en el sitio tiene que
                  estar en una categoría visible.
                </p>
              </>
            )}
          </div>
        ) : (
          /* En el teléfono se ven título y estado; categoría, fecha, fotos y vistas se esconden. */
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Trabajo</th>
                  <th className="px-4 py-3 font-semibold w-32">Estado</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Categoría</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Fecha</th>
                  <th className="hidden px-4 py-3 font-semibold text-right sm:table-cell">Fotos</th>
                  <th className="hidden px-4 py-3 font-semibold text-right lg:table-cell">Vistas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {trabajos.map((t) => {
                  const e = ESTADOS[t.estado] ?? ESTADOS.BORRADOR;
                  const cat = t.categoriaId ? nombreCategoria.get(t.categoriaId) : undefined;
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <Link href={`${TRABAJOS_ADMIN_BASE}/${t.id}`} className="flex items-center gap-3 group">
                          {t.portadaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- miniatura de R2, sin redimensionador
                            <img src={t.portadaUrl} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded object-cover" />
                          ) : (
                            <span className="h-10 w-14 shrink-0 rounded bg-[var(--fo-border-muted)]" aria-hidden />
                          )}
                          <span className="font-medium text-[var(--fo-text)] group-hover:text-[var(--fo-accent)]">{t.titulo}</span>
                        </Link>
                        {t.destacado ? <span className="ml-[4.25rem] text-xs text-[var(--fo-accent)]">Destacado</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${e.clase}`}>{e.label}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--fo-muted)] md:table-cell">
                        {cat ? (
                          <>
                            {cat.nombre}
                            {cat.visible ? null : <span className="ml-1 text-xs">(oculta)</span>}
                          </>
                        ) : (
                          <span className="text-[var(--fo-warning)]">Sin categoría</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--fo-muted)] lg:table-cell">{t.fecha ? fechaLarga(t.fecha) : "—"}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-[var(--fo-muted)] sm:table-cell">{t.cantidadFotos}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-[var(--fo-muted)] lg:table-cell">
                        {t.vistas.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TrabajosShell>
  );
}
