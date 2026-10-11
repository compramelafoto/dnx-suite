import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { leerAjustesGaleria } from "@/lib/galerias/ajustes";
import { prepararConfiguracionGalerias } from "@/lib/galerias/pagina";
import { AjustesForm } from "./ajustes-form";

export const dynamic = "force-dynamic";

/**
 * Configuración → Galería: los valores con los que nace cada galería nueva (mensaje de bienvenida,
 * comentarios y descarga). Cada galería los puede cambiar después. Permiso: `configurar` (dueño o administrador).
 */
export default async function ConfiguracionGaleriaPage() {
  const c = await prepararConfiguracionGalerias();

  if (c.estado === "SIN_PERMISO") {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Galería" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar las galerías.</p>
      </div>
    );
  }
  if (c.estado === "APAGADO") {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Galería" description="Galerías de fotos para que los clientes elijan." />
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Galería todavía no está encendido. Para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      </div>
    );
  }

  const ajustes = await leerAjustesGaleria(c.ctx.workspaceId);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Galería" description="Los valores con los que nace cada galería nueva. Después se pueden cambiar en cada una." />
      <AjustesForm
        inicial={{
          defaultMessage: ajustes.defaultMessage ?? "",
          defaultAllowComments: ajustes.defaultAllowComments,
          defaultDownloadMode: ajustes.defaultDownloadMode,
        }}
      />
    </div>
  );
}
