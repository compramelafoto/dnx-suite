/**
 * Suma del reparto por plataforma para la pantalla de Proveedores.
 *
 * La API (`assertSharesSumTo100` en `@repo/finance-control`) es la que de
 * verdad rechaza un reparto que no sume 100%; esto es sólo para que la
 * persona vea el problema ANTES de mandar el formulario. Redondea a dos
 * decimales para no arrastrar ruido de punto flotante (33.33 + 33.33 + 33.34
 * tiene que mostrar 100, no 99.99999999999999).
 */
export function sumSharePercent(shares: Array<{ sharePercent: number }>): number {
  const suma = shares.reduce((total, parte) => total + (Number(parte.sharePercent) || 0), 0);
  return Math.round(suma * 100) / 100;
}

/** Si el total ya redondeado es exactamente 100%. */
export function isAllocationComplete(totalPercent: number): boolean {
  return Math.abs(totalPercent - 100) < 1e-9;
}
