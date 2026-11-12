"use client";

import { useState, useTransition } from "react";
import { verificarComprobanteAction } from "@/app/actions/bandeja";

/** Botón debajo de una imagen o un PDF del cliente: ¿es un comprobante y el pago entró al Mercado Pago del estudio? */
export function VerificarComprobante({ chatId, mensajeId }: { chatId: string; mensajeId: string }) {
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pendiente}
        className="text-left text-[var(--fo-accent)] underline disabled:opacity-60"
        onClick={() =>
          empezar(async () => {
            const r = await verificarComprobanteAction(chatId, mensajeId);
            setResultado(r.ok ? { ok: true, texto: r.texto } : { ok: false, texto: r.error });
          })
        }
      >
        {pendiente ? "Verificando…" : "Verificar comprobante"}
      </button>
      {resultado ? (
        <span role="status" className={resultado.ok ? "text-[var(--fo-text)]" : "text-[var(--fo-danger)]"}>
          {resultado.texto}
        </span>
      ) : null}
    </span>
  );
}
