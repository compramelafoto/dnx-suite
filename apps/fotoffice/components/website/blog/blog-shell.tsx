import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { BlogSubNav } from "./blog-sub-nav";

/**
 * Marco común de las pantallas del blog.
 *
 * No usa `WebsiteShell`: esa barra publica y despublica la Home del sitio, y acá cada artículo
 * se publica solo desde su propio formulario. Mezclarlas haría pensar que "Publicar" de arriba
 * publica el artículo.
 */
export function BlogShell({
  title = "Blog",
  description = "Los artículos de tu institución. Se publican en el blog de tu sitio web.",
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
      <BlogSubNav />
      <div>{children}</div>
    </div>
  );
}
