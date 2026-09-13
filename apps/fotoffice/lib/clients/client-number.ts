/**
 * El próximo número de cliente. Módulo PURO: recibe el último y decide.
 *
 * No se reutilizan huecos. Si el 33 se borró, el 33 no vuelve: un número de cliente que
 * apunta a dos personas distintas a lo largo del tiempo rompe cualquier comprobante viejo
 * que lo mencione.
 *
 * La condición de carrera —dos altas simultáneas pidiendo el mismo número— NO se resuelve
 * acá: la resuelve el índice único `(workspaceId, clientNumber)` de la base, y quien
 * llama reintenta. Ver `lib/clients/find-or-create.ts`.
 */
export function nextClientNumber(lastNumber: number | null): number {
  if (lastNumber === null || lastNumber < 1) return 1;
  return Math.floor(lastNumber) + 1;
}
