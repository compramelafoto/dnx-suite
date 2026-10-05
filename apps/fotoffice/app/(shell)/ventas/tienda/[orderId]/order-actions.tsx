"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreOrderStatus } from "@repo/db";
import { changeOrderStatusAction, markOrderReviewedAction } from "./actions";

const BOTON: Partial<Record<StoreOrderStatus, string>> = {
  READY: "Marcar listo para retirar",
  DELIVERED: "Marcar entregado",
  PAID: "Ya hay stock: confirmar la venta",
  CANCELLED: "Cancelar el pedido",
};

const CONFIRMAR: Partial<Record<StoreOrderStatus, string>> = {
  READY: "Le vamos a avisar por correo a quien compró que ya puede retirarlo.",
  DELIVERED: "El pedido queda como entregado.",
  PAID: "Se registra la venta, se descuenta el stock y le avisamos a quien compró.",
  CANCELLED: "El pedido se cancela.",
};

/**
 * Los botones del detalle de un pedido. Cuáles se ofrecen lo decide el servidor
 * (`staffTargets`); el servidor vuelve a validarlo todo al guardar.
 */
export function OrderActions({
  orderId,
  targets,
  cancelNeedsNote,
  moneyIn,
  hasSale,
  canMarkReviewed,
}: {
  orderId: string;
  targets: StoreOrderStatus[];
  cancelNeedsNote: boolean;
  /** Entró plata: cancelar implica devolverla desde Mercado Pago. */
  moneyIn: boolean;
  hasSale: boolean;
  canMarkReviewed: boolean;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<StoreOrderStatus | "REVIEW" | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  if (targets.length === 0 && !canMarkReviewed) return null;

  const notaObligatoria = elegido === "REVIEW" || (elegido === "CANCELLED" && cancelNeedsNote);

  function confirmar() {
    if (!elegido) return;
    setError(null);
    startTransition(async () => {
      const r =
        elegido === "REVIEW"
          ? await markOrderReviewedAction({ orderId, note: nota })
          : await changeOrderStatusAction({ orderId, to: elegido, note: nota });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setElegido(null);
      setNota("");
      router.refresh();
    });
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Qué hacer</h2>

      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            disabled={guardando}
            onClick={() => {
              setElegido(t);
              setError(null);
            }}
            className={`fo-btn text-sm ${t === "CANCELLED" ? "fo-btn-danger-outline" : "fo-btn-primary"}`}
          >
            {BOTON[t] ?? t}
          </button>
        ))}
        {canMarkReviewed ? (
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              setElegido("REVIEW");
              setError(null);
            }}
            className="fo-btn fo-btn-ghost text-sm"
          >
            Ya lo revisé
          </button>
        ) : null}
      </div>

      {elegido ? (
        <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
          <p className="text-sm">
            {elegido === "REVIEW"
              ? "Contá qué revisaste o qué hiciste. El pedido deja de figurar en Problemas."
              : CONFIRMAR[elegido]}
          </p>
          {elegido === "CANCELLED" && moneyIn ? (
            <p className="rounded-md border border-[var(--fo-danger)] p-3 text-sm text-[var(--fo-danger)]" role="note">
              Devolvé el dinero desde Mercado Pago: cancelar acá no lo devuelve solo.
              {hasSale ? " La venta asociada se anula y el stock vuelve." : ""}
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">
              {notaObligatoria ? "Nota (obligatoria)" : "Nota (opcional)"}
            </span>
            <textarea
              className="fo-input w-full"
              rows={2}
              maxLength={500}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={elegido === "CANCELLED" ? "Por qué se cancela" : "Algo para dejar anotado"}
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmar}
              disabled={guardando || (notaObligatoria && nota.trim() === "")}
              className={`fo-btn text-sm ${elegido === "CANCELLED" ? "fo-btn-danger-outline" : "fo-btn-primary"}`}
            >
              {guardando ? "Guardando…" : "Confirmar"}
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                setElegido(null);
                setError(null);
              }}
              className="fo-btn fo-btn-ghost text-sm"
            >
              Volver
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
