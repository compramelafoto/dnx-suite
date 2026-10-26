import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { AVISO_TABLAS_TESTIMONIOS } from "@/lib/testimonios/dominio";
import { TestimoniosSubNav } from "./testimonios-sub-nav";

/**
 * Marco de las pantallas de Testimonios. Como Trabajos y el blog, no usa `WebsiteShell` (esa barra
 * publica la Home): cada testimonio se publica solo desde su tarjeta.
 */
export function TestimoniosShell({ pendientes, children }: { pendientes: number; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonios"
        description="Lo que dicen tus clientes. Revisalos antes de publicarlos: sólo los publicados se ven en tu sitio."
      />
      <TestimoniosSubNav pendientes={pendientes} />
      <div>{children}</div>
    </div>
  );
}

/** Cuando el SQL de Testimonios todavía no se aplicó a la base. */
export function AvisoTablasTestimonios() {
  return <p className="fo-alert-warning text-sm">{AVISO_TABLAS_TESTIMONIOS}</p>;
}
