"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Wallet } from "lucide-react";
import { cerrarAction, moverAction } from "@/app/actions/circuitos";
import { cobrarSaldoAction } from "@/app/(shell)/ventas/pedido-actions";
import { InputMoneda } from "@/components/campos/input-moneda";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import { ETIQUETA_MEDIO_COBRO } from "@/lib/pedidos/constantes";
import { etapaSiguiente } from "@/lib/proyectos/en-curso-puro";
import type { TarjetaTrabajo } from "@/lib/proyectos/en-curso";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import { calcularVuelto } from "@/lib/sales/vuelto";

/**
 * «Cobrar y entregar» del tablero "En curso": el cliente vino a retirar y debe saldo. En un solo
 * paso cobra lo que falta del pedido (mismo cobro que «Cobrar saldo» del Cobrador: recibo, Caja y
 * correo) y marca como entregados los trabajos elegidos del pedido. Primero el cobro: si no entra,
 * no se entrega nada (el candado del saldo lo impediría igual).
 */
export function DialogoCobrarEntregar({
  trabajos,
  onCerrar,
  onTerminado,
}: {
  /** El trabajo tocado primero y, después, los otros del mismo pedido que ya están listos. */
  trabajos: TarjetaTrabajo[];
  onCerrar: () => void;
  onTerminado: (aviso: { ok: boolean; texto: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = trabajos[0]!;
  const pedido = t.pedido!;
  const saldo = pedido.saldoMinor;
  const [medio, setMedio] = useState<SalePaymentMethod>("EFECTIVO");
  const [pagaCon, setPagaCon] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(trabajos.map((x) => x.journeyId)));
  const [error, setError] = useState<string | null>(null);
  const [procesando, start] = useTransition();
  // Una sola clave por ventana: un doble clic o un reintento no cobra dos veces.
  const clave = useRef(`ent-${crypto.randomUUID()}`);
  // Si el cobro ya entró y falló la entrega, el reintento no vuelve a cobrar.
  const [cobrado, setCobrado] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const recibido = medio === "EFECTIVO" ? parseArsToMinor(pagaCon) : null;
  const vuelto = calcularVuelto(saldo, recibido);

  function entregar(x: TarjetaTrabajo) {
    const siguiente = x.etapaActualId ? etapaSiguiente(x.etapas, x.etapaActualId) : null;
    return siguiente
      ? moverAction({ journeyId: x.journeyId, destinoId: siguiente.id, esperado: x.enteredStageAt })
      : cerrarAction({ journeyId: x.journeyId, salida: "TERMINADO", esperado: x.enteredStageAt });
  }

  function confirmar() {
    setError(null);
    if (vuelto.estado === "falta") {
      setError(`Con lo que entregó faltan ${formatMinorArs(vuelto.faltaMinor)}.`);
      return;
    }
    start(async () => {
      let mensajeCobro = cobrado;
      if (mensajeCobro === null) {
        const c = await cobrarSaldoAction(pedido.id, medio, clave.current);
        // «ya está pago»: otro cobro (o la vuelta anterior de éste) ya lo saldó; se sigue con la entrega.
        if (!c.ok && !/ya está pago/i.test(c.error)) {
          setError(c.error);
          return;
        }
        mensajeCobro = c.ok ? c.mensaje : `El pedido ${pedido.numero} ya estaba pago.`;
        setCobrado(mensajeCobro);
      }
      const aEntregar = trabajos.filter((x) => elegidos.has(x.journeyId));
      const fallas: string[] = [];
      for (const x of aEntregar) {
        const r = await entregar(x);
        if (!r.ok) fallas.push(`${x.nombre}: ${r.error}`);
      }
      const vueltoTexto = vuelto.estado === "ok" && vuelto.vueltoMinor > 0 ? ` Dar de vuelto ${formatMinorArs(vuelto.vueltoMinor)}.` : "";
      if (fallas.length > 0) {
        setError(`${mensajeCobro} Pero no se pudo marcar como entregado: ${fallas.join(" · ")}`);
        return;
      }
      const entregados =
        aEntregar.length === 0 ? " No se marcó ningún trabajo como entregado." : aEntregar.length === 1 ? " Trabajo entregado." : ` ${aEntregar.length} trabajos entregados.`;
      onTerminado({ ok: true, texto: `${t.cliente}: ${mensajeCobro}${entregados}${vueltoTexto}` });
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="cobrar-entregar-titulo"
      className="fo-card m-auto w-[94vw] max-w-md p-0 backdrop:bg-black/50"
      onClose={onCerrar}
      onClick={(ev) => {
        if (ev.target === ref.current && !procesando) ref.current?.close();
      }}
    >
      <div className="space-y-4 p-5">
        <header className="space-y-1">
          <h2 id="cobrar-entregar-titulo" className="flex items-center gap-2 text-lg font-semibold text-[var(--fo-text)]">
            <Wallet className="size-5" aria-hidden />
            Cobrar y entregar
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {t.cliente} · Pedido {pedido.numero}
          </p>
        </header>

        <div className="flex items-baseline justify-between rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] px-3 py-2">
          <span className="text-sm text-[var(--fo-muted)]">Saldo a cobrar</span>
          <span className="text-2xl font-bold tabular-nums">{formatMinorArs(saldo)}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Medio de pago">
          {SALE_PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={medio === m}
              onClick={() => setMedio(m)}
              disabled={procesando || cobrado !== null}
              className={`rounded-[var(--fo-radius-sm)] border px-2 py-1.5 text-xs font-medium ${
                medio === m
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
                  : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]"
              }`}
            >
              {ETIQUETA_MEDIO_COBRO[m]}
            </button>
          ))}
        </div>

        {medio === "EFECTIVO" && cobrado === null ? (
          <div className="space-y-1">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[var(--fo-muted)]">Paga con (opcional)</span>
              <InputMoneda
                value={pagaCon}
                onChange={setPagaCon}
                placeholder="Para calcular el vuelto"
                className="fo-input h-9 text-right text-sm"
                wrapperClassName="w-44"
                aria-label="Paga con"
              />
            </label>
            {vuelto.estado === "ok" && vuelto.vueltoMinor > 0 ? (
              <p className="text-right text-sm font-semibold text-[var(--fo-text)]">Dar de vuelto {formatMinorArs(vuelto.vueltoMinor)}</p>
            ) : vuelto.estado === "falta" ? (
              <p className="text-right text-sm font-medium text-[var(--fo-danger)]">Faltan {formatMinorArs(vuelto.faltaMinor)}</p>
            ) : null}
          </div>
        ) : null}

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-medium text-[var(--fo-text)]">Se marca como entregado</legend>
          {trabajos.map((x) => (
            <label key={x.journeyId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={elegidos.has(x.journeyId)}
                disabled={procesando}
                onChange={(e) =>
                  setElegidos((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(x.journeyId);
                    else n.delete(x.journeyId);
                    return n;
                  })
                }
              />
              <span className="min-w-0 truncate">
                {x.producto ?? x.nombre} <span className="text-[var(--fo-muted)]">· N° {x.numero}</span>
              </span>
            </label>
          ))}
          {trabajos.length > 1 ? (
            <p className="text-xs text-[var(--fo-muted)]">El saldo es del pedido entero: incluye todos sus trabajos.</p>
          ) : null}
        </fieldset>

        <p className="text-xs text-[var(--fo-muted)]">
          Queda registrado como cobro del pedido, con recibo, y entra a Caja (en efectivo, al turno abierto).
        </p>

        {error ? (
          <p role="alert" className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-danger-soft)] p-3 text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} disabled={procesando} className="fo-btn fo-btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={procesando || vuelto.estado === "falta"}
            className="fo-btn fo-btn-primary inline-flex items-center gap-1.5"
          >
            <Check className="size-4" aria-hidden />
            {procesando
              ? "Cobrando…"
              : cobrado !== null
                ? "Reintentar entrega"
                : `Cobrar ${formatMinorArs(saldo)} y entregar`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
