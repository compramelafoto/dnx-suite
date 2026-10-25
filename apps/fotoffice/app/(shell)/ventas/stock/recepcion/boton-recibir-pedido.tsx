"use client";

import { useFormStatus } from "react-dom";

/** El botón de "Recibir pedido": se apaga mientras se crea el borrador, así dos clics no abren dos. */
export function BotonRecibirPedido() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
      {pending ? "Abriendo…" : "Recibir pedido"}
    </button>
  );
}
