"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarCompraPagadaAManoAction } from "@/app/actions/galerias";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { ETIQUETA_ESTADO_COMPRA, type EstadoCompra } from "@/lib/galerias/compras-reglas";
import { ETIQUETA_MEDIO_COMPRA } from "@/lib/galerias/medios";
import { formatearCentavos } from "@/lib/galerias/precios";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type CompraVista = {
  id: string;
  estado: EstadoCompra;
  fecha: string;
  fotos: number;
  totalCents: number;
  feeCents: number | null;
  medio: string | null;
  proveedor: string | null;
  enCaja: boolean;
};

export type DatosCompras = {
  ventaActiva: boolean;
  compras: CompraVista[];
  ahora: { extras: number; incluidas: number; yaPagadas: number; subtotalCents: number; descuentoCents: number; totalCents: number };
  veDinero: boolean;
  cajaEncendida: boolean;
  cuentas: { id: string; nombre: string; esPorOmision: boolean }[];
};

const CLASE_ESTADO: Record<EstadoCompra, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PAGADA: "bg-green-100 text-green-800",
  CANCELADA: "bg-gray-100 text-gray-700",
};

/**
 * Compras de fotos extra del cliente en la revisión: lo que tiene sin pagar hoy, el historial de compras
 * (fecha, fotos, total, comisión, estado y medio) y "Marcar pagada a mano" (el pago en efectivo, por
 * transferencia o por otro medio; va a Caja si está encendida). El precio lo calcula siempre el servidor.
 */
export function ComprasCliente({
  galeriaId, clienteId, d, hoy, puedeGestionar,
}: {
  galeriaId: string;
  clienteId: string;
  d: DatosCompras;
  /** "aaaa-mm-dd" de hoy en Argentina. */
  hoy: string;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [fecha, setFecha] = useState(hoy);
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!d.ventaActiva && d.compras.length === 0) return null;
  const puedeCobrar = puedeGestionar && d.ventaActiva && d.ahora.extras > 0;

  function marcar(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`¿Marcar como pagadas las ${d.ahora.extras} fotos extra por ${formatearCentavos(d.ahora.totalCents)}? ${d.cajaEncendida ? "Se anota el ingreso en Caja." : "Caja no está encendida: el ingreso no se anota."}`)) return;
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await marcarCompraPagadaAManoAction(galeriaId, clienteId, { metodo, fecha, cuentaId: cuentaId || null }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      setAviso(
        r.sinCaja
          ? `Listo: la compra quedó pagada (${formatearCentavos(r.totalCents)}), pero no se anotó en Caja${r.motivoSinCaja === "SIN_CUENTA" ? " porque no hay una cuenta donde depositarla" : " porque el módulo Caja está apagado"}.`
          : `Listo: la compra quedó pagada (${formatearCentavos(r.totalCents)}) y se anotó en Caja.`,
      );
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="compras-cliente-titulo" className="fo-card space-y-3 p-4">
      <h2 id="compras-cliente-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Compras de fotos extra
      </h2>

      {d.ventaActiva ? (
        <p className="text-sm">
          {d.ahora.extras === 0 ? (
            <span className="text-[var(--fo-muted)]">
              No tiene fotos extra sin pagar{d.ahora.yaPagadas > 0 ? ` (${d.ahora.yaPagadas} ya ${d.ahora.yaPagadas === 1 ? "pagada" : "pagadas"})` : ""}.
            </span>
          ) : (
            <>
              <span className="font-medium">
                {d.ahora.extras} {d.ahora.extras === 1 ? "foto extra sin pagar" : "fotos extra sin pagar"}: {formatearCentavos(d.ahora.totalCents)}
              </span>
              {d.ahora.descuentoCents > 0 ? <span className="text-[var(--fo-muted)]"> (con {formatearCentavos(d.ahora.descuentoCents)} de descuento)</span> : null}
              {d.ahora.incluidas > 0 ? <span className="text-[var(--fo-muted)]"> · {d.ahora.incluidas} {d.ahora.incluidas === 1 ? "incluida" : "incluidas"} sin costo</span> : null}
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">Esta galería ya no vende fotos extra. Quedan las compras que se hicieron antes.</p>
      )}

      {d.compras.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay compras.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--fo-muted)]">
                <th scope="col" className="py-1 pr-3 font-medium">Fecha</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Fotos</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Total</th>
                {d.veDinero ? <th scope="col" className="py-1 pr-3 text-right font-medium">Comisión</th> : null}
                <th scope="col" className="py-1 pr-3 font-medium">Estado</th>
                <th scope="col" className="py-1 font-medium">Medio</th>
              </tr>
            </thead>
            <tbody>
              {d.compras.map((c) => (
                <tr key={c.id} className="border-t border-[var(--fo-border)] align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fechaHoraBA(c.fecha)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{c.fotos}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatearCentavos(c.totalCents)}</td>
                  {d.veDinero ? <td className="py-1.5 pr-3 text-right tabular-nums">{c.feeCents === null ? "—" : formatearCentavos(c.feeCents)}</td> : null}
                  <td className="py-1.5 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[c.estado]}`}>{ETIQUETA_ESTADO_COMPRA[c.estado]}</span>
                    {c.estado === "PAGADA" && !c.enCaja ? <span className="mt-0.5 block text-xs text-[var(--fo-muted)]">Sin anotar en Caja</span> : null}
                  </td>
                  <td className="py-1.5">{c.medio ? (ETIQUETA_MEDIO_COMPRA[c.medio] ?? c.medio) : c.proveedor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeCobrar ? (
        abierto ? (
          <form onSubmit={marcar} className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3" aria-label="Marcar pagada a mano">
            <p className="text-sm font-medium">Marcar pagada a mano: {formatearCentavos(d.ahora.totalCents)}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="compra-metodo">Cómo pagó</label>
                <select id="compra-metodo" className="fo-input" value={metodo} onChange={(e) => setMetodo(e.target.value)} disabled={pendiente}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="OTRO">Otro medio</option>
                </select>
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="compra-fecha">Fecha del pago</label>
                <input id="compra-fecha" type="date" className="fo-input" max={hoy} required value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={pendiente} />
              </div>
              {d.cajaEncendida && d.cuentas.length > 0 ? (
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="compra-cuenta">Cuenta de Caja</label>
                  <select id="compra-cuenta" className="fo-input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} disabled={pendiente}>
                    <option value="">La que corresponde al medio</option>
                    {d.cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-[var(--fo-muted)]">
              {d.cajaEncendida ? "El ingreso se anota en Caja con el rubro de la galería." : "Caja no está encendida: la compra queda pagada pero no se anota ningún ingreso."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || fecha === ""}>
                {pendiente ? "Registrando…" : "Registrar el pago"}
              </button>
              <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setAbierto(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => { setAbierto(true); setError(null); setAviso(null); }}>
            Marcar pagada a mano
          </button>
        )
      ) : null}

      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : aviso ? (
          <p role="status" className="text-sm text-[var(--fo-muted)]">
            {aviso}
          </p>
        ) : null}
      </div>
    </section>
  );
}
