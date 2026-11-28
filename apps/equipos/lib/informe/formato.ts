/** El DNI nunca se muestra completo: sólo los últimos 3 dígitos. */
export function maskDni(last3: string): string {
  return `**.***.${last3.slice(-3)}`;
}

/** Pesos o dólares enteros con punto de miles (es-AR). */
export function formatMoney(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
