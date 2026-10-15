import type { ReactNode } from "react";

/**
 * Una pantalla a la que se puede llegar desde el buscador.
 *
 * Es deliberadamente pobre: permisos, módulos y estado activo YA fueron resueltos por la app
 * antes de armar la lista. El buscador no decide qué puede ver nadie — solo filtra lo que le
 * dan. Ver §4 del spec.
 */
export type QuickSearchEntry = {
  /** Único y estable. Sirve de key de React y de identificador en los tests. */
  id: string;
  /** Lo que se lee en el menú. "Cuotas". */
  label: string;
  href: string;
  /** La sección del menú a la que pertenece. "Socios". Agrupa los resultados. */
  group: string;
  /** Qué se hace ahí, en una línea. Se busca dentro. */
  description?: string;
  /** Sinónimos: las palabras que la gente usa de verdad. */
  keywords?: string[];
  /** La app decide cómo dibujarlo. El paquete no conoce ningún catálogo de íconos. */
  icon?: ReactNode;
};
