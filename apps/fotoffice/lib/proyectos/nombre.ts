/**
 * Nombre de un proyecto a partir de la plantilla de la regla (Etapa 4, Entrega A). Módulo PURO.
 * Variables: {contacto}, {producto}, {evento} y {pedido}. Una variable desconocida se deja tal cual;
 * una conocida sin valor queda vacía. El resultado va recortado y con un tope de 200 caracteres.
 */
import { LARGO_MAXIMO_NOMBRE, PLANTILLA_NOMBRE_POR_OMISION, type VariableNombre } from "./constantes";

export type ValoresNombre = Partial<Record<VariableNombre, string | null | undefined>>;

function reemplazar(plantilla: string, valores: ValoresNombre): string {
  return plantilla
    .replace(/\{(contacto|producto|evento|pedido)\}/g, (_m, k: VariableNombre) => valores[k] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function aplicarPlantillaNombre(plantilla: string | null | undefined, valores: ValoresNombre): string {
  const propia = plantilla?.trim() ? plantilla : null;
  let nombre = propia ? reemplazar(propia, valores) : "";
  // Una plantilla que queda en blanco (todas sus variables vacías) cae a la de por omisión.
  if (!nombre) nombre = reemplazar(PLANTILLA_NOMBRE_POR_OMISION, valores).replace(/^[·\s]+|[·\s]+$/g, "");
  if (!nombre) nombre = "Proyecto";
  return nombre.slice(0, LARGO_MAXIMO_NOMBRE).trimEnd();
}
