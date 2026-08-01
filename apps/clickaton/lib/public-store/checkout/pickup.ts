/**
 * Puntos de retiro Clickatón (configuración estática hasta logística).
 * Envío a domicilio: deshabilitado — sin proveedor tarifario.
 */

export type StorePickupPoint = {
  id: string;
  label: string;
  instructions: string;
  scheduleNote: string;
};

export const STORE_PICKUP_POINTS: readonly StorePickupPoint[] = [
  {
    id: "clickaton-default",
    label: "Punto de retiro Clickatón (a confirmar por email)",
    instructions:
      "Te enviaremos la dirección exacta y el horario cuando el pedido esté listo para retirar.",
    scheduleNote: "Retiro coordinado por email / WhatsApp operativo (plazo a confirmar).",
  },
] as const;

export function getStorePickupPoint(id: string): StorePickupPoint | null {
  return STORE_PICKUP_POINTS.find((p) => p.id === id) ?? null;
}

export const STORE_SHIPPING_ENABLED = false;
