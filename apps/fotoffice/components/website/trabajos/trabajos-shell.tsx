import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { AVISO_TABLAS_FALTANTES } from "@/lib/trabajos/reglas";
import { TrabajosSubNav } from "./trabajos-sub-nav";

/**
 * Marco de las pantallas de Trabajos. Como el blog, no usa `WebsiteShell`: esa barra publica la
 * Home del sitio, y acá cada trabajo se publica solo desde su ficha.
 */
export function TrabajosShell({
  title = "Trabajos",
  description = "Las coberturas y sesiones de tu estudio, con sus fotos. Se muestran en la sección Trabajos de tu sitio.",
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      <TrabajosSubNav />
      <div>{children}</div>
    </div>
  );
}

/** Cuando el SQL de Trabajos todavía no se aplicó a la base. */
export function AvisoTablasFaltantes() {
  return <p className="fo-alert-warning text-sm">{AVISO_TABLAS_FALTANTES}</p>;
}
