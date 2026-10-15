/**
 * Título de una cita creada desde una regla de producto (Etapa 4, Entrega B). Módulo PURO.
 * Variables: {contacto}, {producto}, {evento} y {pedido}. Una variable desconocida se deja tal cual;
 * una conocida sin valor queda vacía. Sin plantilla, o si queda en blanco, el título es el producto
 * (o «Cita» si tampoco hay). Tope de 200 caracteres.
 */
export const TITULO_CITA_MAXIMO_REGLA = 200;

export type VariableTitulo = "contacto" | "producto" | "evento" | "pedido";
export type ValoresTitulo = Partial<Record<VariableTitulo, string | null | undefined>>;

function reemplazar(plantilla: string, valores: ValoresTitulo): string {
  return plantilla
    .replace(/\{(contacto|producto|evento|pedido)\}/g, (_m, k: VariableTitulo) => valores[k] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function aplicarPlantillaTitulo(plantilla: string | null | undefined, valores: ValoresTitulo): string {
  const propia = plantilla?.trim() ? plantilla : null;
  let titulo = propia ? reemplazar(propia, valores) : "";
  if (!titulo) titulo = reemplazar("{producto}", valores);
  if (!titulo) titulo = "Cita";
  return titulo.slice(0, TITULO_CITA_MAXIMO_REGLA).trimEnd();
}
