import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { listarPropuestasModelo } from "@/lib/presupuestos/propuestas-modelo";
import { PestanasPresupuestos } from "../pestanas";

export const dynamic = "force-dynamic";

/**
 * Configuración → Presupuestos → Propuestas modelo (spec §2 B.13, §3.4): cada categoría de consulta
 * con su propuesta (sí o no) y si sale sola con las consultas del formulario web. Permiso:
 * `configurar`, antes de cualquier lectura.
 */
export default async function PropuestasModeloPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Presupuestos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los presupuestos.</p>
      </div>
    );
  }
  const categorias =
    (await listarPropuestasModelo({ workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role })) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Una propuesta modelo por categoría: productos del catálogo a precio de lista, conceptos calculados con ¿Cuánto Cobro? y condiciones, lista para mandar."
      />
      <PestanasPresupuestos activa="propuestas" />
      <p className="text-sm text-[var(--fo-muted)]">
        Si una propuesta tiene encendido «Enviar sola al llegar una consulta web», la consulta de esa categoría que llegue por el
        formulario recibe el presupuesto por correo en lugar de la respuesta automática (que tiene que estar encendida en
        Configuración → Plantillas → Automáticos). Nunca salen las dos.
      </p>
      {categorias.length === 0 ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">Todavía no hay categorías de consulta activas.</p>
      ) : (
        <ul className="fo-card divide-y divide-[var(--fo-border)] p-0">
          {categorias.map((c) => (
            <li key={c.categoriaId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-[var(--fo-text)]">{c.nombre}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {c.tienePropuesta
                    ? `Con propuesta · ${c.cantidadItems === 1 ? "1 producto" : `${c.cantidadItems} productos`}${c.enviarSola ? " · sale sola con la consulta web" : ""}`
                    : "Sin propuesta"}
                </p>
              </div>
              <Link
                href={`/workspace/configuracion/presupuestos/propuestas/${encodeURIComponent(c.categoriaId)}`}
                className="fo-btn fo-btn-secondary text-sm"
                aria-label={`${c.tienePropuesta ? "Editar" : "Armar"} la propuesta de ${c.nombre}`}
              >
                {c.tienePropuesta ? "Editar" : "Armar"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
