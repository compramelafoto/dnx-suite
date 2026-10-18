import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { cambiarActivoProveedorAction, guardarProveedorAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Los laboratorios y talleres a los que se mandan trabajos. Al pasar un trabajo a "Enviado" se
 * elige uno; si tiene correo, se le manda el pedido.
 */
export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  const params = await searchParams;
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Proveedores" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden cambiar los proveedores.</p>
      </div>
    );
  }
  const proveedores = await listarProveedores(workspace.id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Proveedores"
        description="Los laboratorios y talleres a los que mandás trabajos. Con correo cargado, al enviarles un trabajo les llega el pedido."
      />
      {params.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">{params.error}</p> : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}

      <form action={guardarProveedorAction} className="fo-card grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Agregar proveedor</h2>
        <input name="name" required placeholder="Nombre (ej.: Fotolag)" className="fo-input" />
        <input name="email" type="email" placeholder="Correo para los pedidos" className="fo-input" />
        <input name="phone" placeholder="Teléfono o WhatsApp" className="fo-input" />
        <input name="notes" placeholder="Notas (ej.: retira los martes)" className="fo-input" />
        <div className="sm:col-span-2">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Agregar
          </button>
        </div>
      </form>

      {proveedores.length === 0 ? (
        <p className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">Todavía no hay proveedores.</p>
      ) : (
        <ul className="space-y-3">
          {proveedores.map((p) => (
            <li key={p.id} className={`fo-card p-4 ${p.active ? "" : "opacity-60"}`}>
              <form action={guardarProveedorAction} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={p.id} />
                <input name="name" defaultValue={p.name} required className="fo-input font-semibold" aria-label="Nombre" />
                <input name="email" type="email" defaultValue={p.email ?? ""} placeholder="Correo" className="fo-input" aria-label="Correo" />
                <input name="phone" defaultValue={p.phone ?? ""} placeholder="Teléfono" className="fo-input" aria-label="Teléfono" />
                <input name="notes" defaultValue={p.notes ?? ""} placeholder="Notas" className="fo-input" aria-label="Notas" />
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                    Guardar
                  </button>
                  <span className="text-xs text-[var(--fo-muted)]">
                    {p.trabajos} {p.trabajos === 1 ? "trabajo" : "trabajos"}
                    {p.email ? "" : " · sin correo: el pedido no se le manda solo"}
                  </span>
                </div>
              </form>
              <form action={cambiarActivoProveedorAction} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                <button type="submit" className="text-xs text-[var(--fo-muted)] hover:text-[var(--fo-text)] hover:underline">
                  {p.active ? "Desactivar" : "Volver a activar"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
