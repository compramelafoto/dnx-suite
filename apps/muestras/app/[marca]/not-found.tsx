import { CuerpoNoEncontrada } from "@/components/no-encontrada/no-encontrada";

/**
 * 404 de un `notFound()` dentro de una página de la marca (p. ej. `/m/<slug>` de una muestra que
 * no existe): se dibuja dentro de `app/[marca]/layout.tsx`, con encabezado y pie. Las URLs que no
 * corresponden a ninguna página no pasan por acá: las atiende `app/not-found.tsx`.
 */
export default function NoEncontrada() {
  return <CuerpoNoEncontrada />;
}
