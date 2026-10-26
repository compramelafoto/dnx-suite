/**
 * Lo puro del formulario de presupuesto del sitio (bloque INQUIRY_FORM): lo usan la vista (en el
 * navegador) y el inspector, sin tocar la base. Lo que lee la base está en `inquiry.ts`.
 */
import { WEBSITE_BLOCK_DEFINITIONS, type InquiryFormBlock } from "./blocks";
import { PRESUPUESTO_PAGE_LABEL } from "./constants";

export type OpcionDelFormulario = { id: string; nombre: string };

/**
 * El único bloque de la página `/w/<slug>/presupuesto`: el formulario con la config por omisión
 * (todas las categorías activas) y el nombre de la página como título.
 */
export function bloqueDePaginaPresupuesto(): InquiryFormBlock {
  return {
    id: "presupuesto",
    type: "INQUIRY_FORM",
    visible: true,
    order: 0,
    config: { ...WEBSITE_BLOCK_DEFINITIONS.INQUIRY_FORM.defaultConfig(), title: PRESUPUESTO_PAGE_LABEL },
  };
}

/**
 * Las categorías que ofrece un bloque: las elegidas por el dueño (en el orden del workspace) o,
 * con la lista vacía, todas las activas. Si todas las elegidas se archivaron, ofrece todas:
 * un formulario sin opciones no le serviría a nadie.
 */
export function categoriasDelBloque(categoryIds: readonly string[], activas: readonly OpcionDelFormulario[]): OpcionDelFormulario[] {
  if (categoryIds.length === 0) return [...activas];
  const elegidas = new Set(categoryIds);
  const filtradas = activas.filter((c) => elegidas.has(c.id));
  return filtradas.length > 0 ? filtradas : [...activas];
}

/** La vista previa del constructor no lee la base: muestra el formulario con estas de ejemplo. */
export const CATEGORIAS_DE_EJEMPLO: readonly OpcionDelFormulario[] = [
  { id: "ejemplo-1", nombre: "Boda" },
  { id: "ejemplo-2", nombre: "Cumpleaños de 15" },
  { id: "ejemplo-3", nombre: "Sesión de fotos" },
];

export const ORIGENES_DE_EJEMPLO: readonly OpcionDelFormulario[] = [
  { id: "ejemplo-1", nombre: "Instagram" },
  { id: "ejemplo-2", nombre: "Recomendación" },
];
