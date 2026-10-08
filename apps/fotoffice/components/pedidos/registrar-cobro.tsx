"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { enlaceDelReciboAction, registrarCobroAction } from "@/app/actions/pedidos";
import { subirAdjuntoConId } from "@/components/ficha/subir-adjunto";
import { ETIQUETA_MEDIO_COBRO, MEDIOS_COBRO, type MedioCobro } from "@/lib/pedidos/constantes";
import type { OpcionesEnvioPedido } from "@/lib/pedidos/envio";
import { claveDeCobro, fechaCorta, importeSugerido, leerImporte, pesosPedido, sumarPesos, type CuotaParaCobro } from "@/lib/pedidos/pantalla";
import { aCentavos } from "@/lib/pedidos/plan-cuotas";
import { EnviarPedido } from "./enviar-pedido";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/** Reparto automático (de la más vieja a la más nueva), para arrancar el reparto a mano. */
function repartoInicial(cuotas: readonly CuotaParaCobro[], importe: number): Record<string, string> {
  let resto = aCentavos(importe);
  const out: Record<string, string> = {};
  for (const c of [...cuotas].sort((a, b) => a.position - b.position)) {
    const toma = Math.min(resto, aCentavos(c.saldo));
    out[c.id] = toma > 0 ? String(toma / 100) : "";
    resto -= toma;
  }
  return out;
}

type Hecho = { cobroId: string; numero: string; importe: number };

/**
 * "Registrar cobro" (con "Gestionar"): importe (por omisión, el saldo de la cuota más vieja),
 * fecha (hoy en Argentina), medio (los 5 de Caja), comprobante opcional y reparto entre cuotas
 * (automático o a mano). La clave de idempotencia se genera una vez por cada vez que se abre el
 * diálogo: un doble clic devuelve el mismo cobro. Al guardar muestra el recibo con "Enviar por
 * correo", "WhatsApp" e "Imprimir".
 *
 * El comprobante se sube a la ficha del contacto (como cualquier adjunto) y el cobro lo
 * referencia; sin "Gestionar" en Clientes no se ofrece.
 */
export function RegistrarCobro({
  pedidoId,
  clientId,
  cuotas,
  saldoPedido,
  hoy,
  puedeAdjuntar,
  envio,
  puedeCobrar,
}: {
  pedidoId: string;
  clientId: string;
  /** Cuotas con saldo, en orden. */
  cuotas: CuotaParaCobro[];
  saldoPedido: number;
  hoy: string;
  puedeAdjuntar: boolean;
  envio: OpcionesEnvioPedido | null;
  /**
   * Si se ofrece el botón (pedido sin cancelar y con saldo). El componente queda montado aunque no:
   * así, cuando un cobro salda el pedido y la ficha se refresca, la vista del recibo sigue abierta.
   */
  puedeCobrar: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [clave, setClave] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [medio, setMedio] = useState<MedioCobro>("EFECTIVO");
  const [aMano, setAMano] = useState(false);
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const [archivo, setArchivo] = useState<File | null>(null);
  const [adjunto, setAdjunto] = useState<{ archivo: File; id: string } | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Hecho | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  function abrir() {
    const sugerido = importeSugerido(cuotas);
    setClave(claveDeCobro());
    setImporte(sugerido > 0 ? String(sugerido) : "");
    setFecha(hoy);
    setMedio("EFECTIVO");
    setAMano(false);
    setReparto({});
    setArchivo(null);
    setAdjunto(null);
    setProgreso(null);
    setError(null);
    setHecho(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    if (hecho) router.refresh();
  }

  const monto = leerImporte(importe);
  const repartido = sumarPesos(Object.values(reparto).map((v) => leerImporte(v) ?? 0));

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (pendiente) return;
    if (monto === null) return setError("Escribí un importe mayor que cero, con hasta dos decimales.");
    if (aCentavos(monto) > aCentavos(saldoPedido)) return setError(`El importe supera el saldo del pedido (${pesosPedido(saldoPedido)}).`);
    if (!fecha || fecha > hoy) return setError("La fecha no puede ser posterior a hoy.");
    let imputaciones: { cuotaId: string; amountArs: number }[] | null = null;
    if (aMano) {
      imputaciones = Object.entries(reparto)
        .map(([cuotaId, v]) => ({ cuotaId, amountArs: leerImporte(v) ?? 0 }))
        .filter((i) => i.amountArs > 0);
      if (aCentavos(repartido) !== aCentavos(monto)) return setError("El reparto entre cuotas tiene que sumar el importe del cobro.");
    }
    setError(null);
    iniciar(async () => {
      try {
        // El comprobante se sube una sola vez (si se reintenta el guardado, se reusa).
        let adjuntoId: string | null = null;
        if (archivo) {
          if (adjunto && adjunto.archivo === archivo) adjuntoId = adjunto.id;
          else {
            setProgreso(0);
            const s = await subirAdjuntoConId({ tipo: "CLIENTE", id: clientId }, archivo, setProgreso);
            setProgreso(null);
            if (!s.ok) {
              setError(`No se pudo subir el comprobante: ${s.error}`);
              return;
            }
            setAdjunto({ archivo, id: s.id });
            adjuntoId = s.id;
          }
        }
        const r = await registrarCobroAction({ pedidoId, importe: monto, fecha, medio, imputaciones, adjuntoId, idempotencyKey: clave });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        // El importe que guardó el servidor (en un reintento con la misma clave, el del cobro que ya estaba).
        setHecho({ cobroId: r.cobroId, numero: r.reciboNumero, importe: r.importe });
        router.refresh();
      } catch {
        setProgreso(null);
        setError(ERROR_CONEXION);
      }
    });
  }

  return (
    <>
      {puedeCobrar ? (
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={abrir} disabled={cuotas.length === 0}>
          Registrar cobro
        </button>
      ) : null}
      <dialog
        ref={ref}
        aria-labelledby={`cobro-titulo-${pedidoId}`}
        className="fo-card w-[92vw] max-w-xl p-0 backdrop:bg-black/50"
        onCancel={(ev) => {
          if (pendiente) ev.preventDefault();
        }}
        onClose={() => {
          if (abierto) cerrar();
        }}
      >
        {abierto && hecho ? (
          <div className="space-y-4 p-6">
            <h2 id={`cobro-titulo-${pedidoId}`} className="text-lg font-semibold text-[var(--fo-text)]">
              Cobro registrado
            </h2>
            <p className="text-sm text-[var(--fo-text)]">
              Recibo N° <strong>{hecho.numero}</strong> por {pesosPedido(hecho.importe)}. Si la plantilla automática “Recibo de pago” está
              encendida y el contacto tiene correo, el recibo ya sale solo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Imprimir cobroId={hecho.cobroId} />
            </div>
            {envio ? <EnviarPedido pedidoId={pedidoId} opciones={envio} cobroId={hecho.cobroId} /> : null}
            <div className="flex justify-end">
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cerrar}>
                Cerrar
              </button>
            </div>
          </div>
        ) : abierto ? (
          <form className="space-y-4 p-6" onSubmit={guardar}>
            <div className="space-y-1">
              <h2 id={`cobro-titulo-${pedidoId}`} className="text-lg font-semibold text-[var(--fo-text)]">
                Registrar cobro
              </h2>
              <p className="text-sm text-[var(--fo-muted)]">Saldo del pedido: {pesosPedido(saldoPedido)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="fo-field-stack text-sm">
                <span className="fo-label">Importe</span>
                <input
                  className="fo-input tabular-nums"
                  inputMode="decimal"
                  value={importe}
                  onChange={(e) => {
                    setImporte(e.target.value);
                    if (aMano) {
                      const n = leerImporte(e.target.value);
                      if (n !== null) setReparto(repartoInicial(cuotas, n));
                    }
                  }}
                  required
                />
              </label>
              <label className="fo-field-stack text-sm">
                <span className="fo-label">Fecha</span>
                <input type="date" className="fo-input" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required />
              </label>
              <label className="fo-field-stack text-sm">
                <span className="fo-label">Medio</span>
                <select className="fo-input" value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
                  {MEDIOS_COBRO.map((m) => (
                    <option key={m} value={m}>
                      {ETIQUETA_MEDIO_COBRO[m]}
                    </option>
                  ))}
                </select>
              </label>
              {puedeAdjuntar ? (
                <label className="fo-field-stack text-sm">
                  <span className="fo-label">Comprobante (opcional)</span>
                  <input type="file" className="fo-input" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                  {progreso !== null ? <span className="text-xs text-[var(--fo-muted)]">Subiendo… {progreso} %</span> : null}
                </label>
              ) : null}
            </div>

            <fieldset className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={aMano}
                  onChange={(e) => {
                    setAMano(e.target.checked);
                    if (e.target.checked && monto !== null) setReparto(repartoInicial(cuotas, monto));
                  }}
                />
                Repartir entre las cuotas a mano
              </label>
              {!aMano ? (
                <p className="text-xs text-[var(--fo-muted)]">Se imputa solo, de la cuota más vieja a la más nueva.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--fo-muted)]">
                      <th className="py-1 pr-2 font-medium">Cuota</th>
                      <th className="py-1 pr-2 font-medium">Vence</th>
                      <th className="py-1 pr-2 text-right font-medium">Saldo</th>
                      <th className="py-1 font-medium">A esta cuota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((c) => (
                      <tr key={c.id} className="border-t border-[var(--fo-border)]">
                        <td className="py-1 pr-2 tabular-nums">{c.position}</td>
                        <td className="py-1 pr-2">{fechaCorta(c.dueDate)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{pesosPedido(c.saldo)}</td>
                        <td className="py-1">
                          <input
                            className="fo-input w-32 tabular-nums"
                            inputMode="decimal"
                            aria-label={`Importe para la cuota ${c.position}`}
                            value={reparto[c.id] ?? ""}
                            onChange={(e) => setReparto({ ...reparto, [c.id]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {aMano ? (
                <p className={`text-xs ${monto !== null && aCentavos(repartido) === aCentavos(monto) ? "text-[var(--fo-muted)]" : "text-[var(--fo-danger)]"}`}>
                  Repartido {pesosPedido(repartido)} de {monto !== null ? pesosPedido(monto) : "—"}
                </p>
              ) : null}
            </fieldset>

            {error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cerrar} disabled={pendiente}>
                Cancelar
              </button>
              <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
                {pendiente ? "Guardando…" : "Registrar cobro"}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}

/** "Imprimir": abre el recibo público (con su vista para imprimir o guardar como PDF). */
export function Imprimir({ cobroId, etiqueta = "Imprimir", clase = "fo-btn fo-btn-secondary text-sm" }: { cobroId: string; etiqueta?: string; clase?: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={clase}
        disabled={pendiente}
        onClick={() => {
          setError(null);
          const pestana = window.open("", "_blank");
          if (pestana) pestana.opener = null;
          iniciar(async () => {
            const r = await enlaceDelReciboAction({ cobroId }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
            if (!r.ok) {
              pestana?.close();
              setError(r.error);
              return;
            }
            if (pestana && !pestana.closed) pestana.location.href = r.url;
            else setEnlace(r.url);
          });
        }}
      >
        {etiqueta}
      </button>
      {enlace ? (
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--fo-accent)] hover:underline">
          Abrir el recibo
        </a>
      ) : null}
      {error ? (
        <span role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
