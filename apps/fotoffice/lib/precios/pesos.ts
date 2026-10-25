/**
 * Un importe escrito con la palabra: «193.900 pesos». Es la forma del portal del socio, donde «$»
 * solo se confunde con dólares; el panel sigue con `pesos()` de `lib/presupuestos/editor`.
 */
export function enPesos(n: number): string {
  const redondeado = Math.round(Number.isFinite(n) ? n : 0);
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(redondeado)} pesos`;
}
