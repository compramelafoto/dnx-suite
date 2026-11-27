import type { GearItemStatus } from "@/lib/inventario/tipos";

const CLASES: Record<GearItemStatus, string> = {
  IN_USE: "estado",
  FOR_SALE: "estado estado-publicada",
  SOLD: "estado estado-vendida",
  STOLEN: "estado estado-alerta",
  LOST: "estado estado-alerta",
  RECOVERED: "estado",
};

/**
 * Píldora con el estado de un equipo del inventario. El texto llega de afuera (`STATUS_LABELS`)
 * para no cargar la lógica del inventario en las piezas.
 */
export function EstadoEquipo({ status, texto }: { status: GearItemStatus; texto: string }) {
  return <span className={CLASES[status]}>{texto}</span>;
}
