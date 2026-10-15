import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { leerAjustesContratos } from "@/lib/contratos/ajustes";
import { prepararConfiguracionContratos } from "@/lib/contratos/pagina";
import { leerPlantilla, listarPlantillas } from "@/lib/contratos/plantillas";
import { EditorPlantilla } from "./editor-plantilla";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Configuración → Contratos → Plantillas: la lista y, con `?editar=<id>` o `?nueva=1`, el editor del
 * texto con selector de variables y vista previa sobre un pedido de ejemplo. Permiso: `configurar`.
 */
export default async function PlantillasDeContratoPage({ searchParams }: { searchParams: Promise<{ editar?: string; nueva?: string }> }) {
  const c = await prepararConfiguracionContratos();

  if (c.estado === "SIN_PERMISO") {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Plantillas de contrato" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar las plantillas de contrato.</p>
      </div>
    );
  }
  if (c.estado === "APAGADO") {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Plantillas de contrato" />
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Contratos todavía no está encendido. Para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      </div>
    );
  }

  const { editar, nueva } = await searchParams;
  const [plantillas, ajustes] = await Promise.all([listarPlantillas(c.ctx), leerAjustesContratos(c.ctx.workspaceId)]);
  const enEdicion = editar && ID_VALIDO.test(editar) ? await leerPlantilla(c.ctx, editar) : null;
  const empresa = { nombre: ajustes.companyName, cuit: ajustes.companyTaxId, domicilio: ajustes.companyAddress };
  const hoy = new Date().toISOString();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Plantillas de contrato"
        description="El texto de tus contratos. Las variables entre corchetes se completan con los datos del pedido."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/configuracion/contratos/plantillas?nueva=1" className="fo-btn fo-btn-primary text-sm">
              Nueva plantilla
            </Link>
            <Link href="/workspace/configuracion/contratos" className="fo-btn fo-btn-secondary text-sm">
              Volver a Contratos
            </Link>
          </div>
        }
      />

      {enEdicion ? (
        <EditorPlantilla
          key={enEdicion.id}
          plantilla={{ id: enEdicion.id, name: enEdicion.name, body: enEdicion.body, isActive: enEdicion.isActive, order: enEdicion.order }}
          empresa={empresa}
          hoy={hoy}
        />
      ) : nueva ? (
        <EditorPlantilla key="nueva" plantilla={null} empresa={empresa} hoy={hoy} />
      ) : null}

      <section className="fo-card space-y-3 p-5" aria-labelledby="lista-plantillas-titulo">
        <h2 id="lista-plantillas-titulo" className="text-base font-semibold">
          Tus plantillas
        </h2>
        {plantillas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay plantillas. Creá la primera con «Nueva plantilla».</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {plantillas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{p.name}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${p.isActive ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]" : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"}`}>
                    {p.isActive ? "Activa" : "Inactiva"}
                  </span>
                  <span className="ml-2 text-xs text-[var(--fo-muted)]">Orden {p.order}</span>
                </span>
                <Link href={`/workspace/configuracion/contratos/plantillas?editar=${encodeURIComponent(p.id)}`} className="fo-btn fo-btn-secondary text-sm">
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
