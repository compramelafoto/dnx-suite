/** Columnas del tablero de reclamos (embudo), en orden. Los cerrados se ven en Resuelto. */
export const COLUMNAS = [
  { id: "OPEN", titulo: "Nuevo" },
  { id: "IN_PROGRESS", titulo: "En curso" },
  { id: "WAITING_CUSTOMER", titulo: "Esperando al cliente" },
  { id: "RESOLVED", titulo: "Resuelto" },
] as const;

export type ColumnaId = (typeof COLUMNAS)[number]["id"];

export function columnaDe(status: string): ColumnaId {
  if (status === "CLOSED") return "RESOLVED";
  return (COLUMNAS.find((c) => c.id === status)?.id ?? "OPEN") as ColumnaId;
}
