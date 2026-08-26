"use client";

import { useState, useTransition } from "react";
import { setCardOperatorAction } from "@/app/actions/card-operators";

/**
 * Los dos permisos de una persona sobre los carnets.
 *
 * Se guardan al tocar la casilla, sin botón de confirmar: son dos interruptores, y obligar a
 * confirmar dos interruptores agrega un paso que nadie recuerda dar.
 */
export function OperatorRow({
  userId,
  canProduce,
  canDeliver,
}: {
  userId: number;
  canProduce: boolean;
  canDeliver: boolean;
}) {
  const [produce, setProduce] = useState(canProduce);
  const [entrega, setEntrega] = useState(canDeliver);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar(siguienteProduce: boolean, siguienteEntrega: boolean) {
    const antesProduce = produce;
    const antesEntrega = entrega;
    setProduce(siguienteProduce);
    setEntrega(siguienteEntrega);
    setError(null);

    startTransition(async () => {
      const data = new FormData();
      data.set("userId", String(userId));
      data.set("canProduce", siguienteProduce ? "1" : "0");
      data.set("canDeliver", siguienteEntrega ? "1" : "0");
      const r = await setCardOperatorAction(data);
      if (!r.ok) {
        // Se vuelve atrás en la pantalla: dejar la casilla marcada cuando el permiso no se
        // guardó haría creer que el impresor ya puede trabajar.
        setProduce(antesProduce);
        setEntrega(antesEntrega);
        setError(r.error);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={produce}
            disabled={pendiente}
            onChange={(e) => guardar(e.target.checked, entrega)}
          />
          Imprimir
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={entrega}
            disabled={pendiente}
            onChange={(e) => guardar(produce, e.target.checked)}
          />
          Entregar
        </label>
      </div>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
