"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  anularPagoCuentaAction,
  borrarCuentaPagarAction,
  generarCostosAction,
  guardarCuentaPagarAction,
  pagarCuentaAction,
} from "@/app/actions/pedidos";
import { subirAdjuntoConId } from "@/components/ficha/subir-adjunto";
import { claseDeColorEtiqueta, fechaHoraBA } from "@/lib/ficha/formato";
import { ETIQUETA_MEDIO_COBRO, MEDIOS_COBRO, esMedioCobro, type MedioCobro } from "@/lib/pedidos/constantes";
import type { CuentaVista, OpcionProveedor } from "@/lib/pedidos/cuentas-pagar";
import { COLOR_ESTADO_CUENTA, ETIQUETA_ESTADO_CUENTA, type Margenes } from "@/lib/pedidos/cuentas-pagar-estado";
import { fechaCorta, leerImporte, pesosPedido } from "@/lib/pedidos/pantalla";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const MAX_MOTIVO = 1000;
const MAX_CONCEPTO = 200;

type Opcion = { id: string; nombre: string };

/** Clave del formulario de pago: una por cada vez que se abre. */
function claveDePago(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `pago-${c.randomUUID()}`;
  return `pago-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type Borrador = { id: string | null; concepto: string; importe: string; vence: string; proveedor: string; rubro: string };

const VACIO: Borrador = { id: null, concepto: "", importe: "", vence: "", proveedor: "", rubro: "" };

/**
 * "Costos y pagos" de la ficha del pedido: las cuentas a pagar con su estado, los márgenes y, con
 * "Gestionar", agregar, editar y borrar (sólo sin pagar), pagar (fecha, medio y rubro de costo
 * obligatorio; egreso en Caja) y anular el pago con motivo. Sin cuentas, "Generar costos" las crea
 * desde el catálogo. Sólo se monta para quien ve costos (`veCostosDePedido`); las reglas las vuelve
 * a mirar el servidor.
 */
export function CostosYPagos({
  pedidoId,
  cuentas,
  margenes,
  gestiona,
  puedeAdjuntar,
  cancelado,
  proveedores,
  rubros,
  hoy,
}: {
  pedidoId: string;
  cuentas: CuentaVista[];
  margenes: Margenes;
  gestiona: boolean;
  /** "Gestionar" en Clientes: puede subir el comprobante a la ficha del proveedor (igual que en los cobros). */
  puedeAdjuntar: boolean;
  cancelado: boolean;
  proveedores: OpcionProveedor[];
  rubros: Opcion[];
  hoy: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pagando, setPagando] = useState<CuentaVista | null>(null);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, luego?: () => void) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        luego?.();
        router.refresh();
      } else setError(r.error);
    });
  }

  function generar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await generarCostosAction({ pedidoId }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      if (r.mensaje) setAviso(r.mensaje);
      if (r.creadas > 0) router.refresh();
    });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    const importe = leerImporte(borrador.importe);
    if (!borrador.concepto.trim()) return setError("Escribí el concepto.");
    if (importe === null) return setError("Escribí un importe mayor que cero, con hasta dos decimales.");
    const b = borrador;
    correr(
      () =>
        guardarCuentaPagarAction({
          id: b.id,
          pedidoId: b.id ? null : pedidoId,
          concepto: b.concepto,
          importe,
          vence: b.vence || null,
          supplierClientId: b.proveedor || null,
          costCategoryId: b.rubro || null,
        }),
      () => setBorrador(null),
    );
  }

  function anular(e: React.FormEvent, cuentaId: string) {
    e.preventDefault();
    if (!motivo.trim()) return setError("Escribí el motivo de la anulación.");
    correr(() => anularPagoCuentaAction({ cuentaId, motivo }), () => {
      setAnulando(null);
      setMotivo("");
    });
  }

  const editable = gestiona;
  const proveedoresDeCategoria = proveedores.filter((p) => p.esProveedor);
  const otrosContactos = proveedores.filter((p) => !p.esProveedor);

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--fo-muted)]">Costos</dt>
          <dd className="tabular-nums">{pesosPedido(margenes.costos)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--fo-muted)]">Pagados</dt>
          <dd className="tabular-nums">{pesosPedido(margenes.costosPagados)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--fo-muted)]" title="Total del pedido − todos los costos">
            Margen previsto
          </dt>
          <dd className="tabular-nums">{pesosPedido(margenes.margenPrevisto)}</dd>
        </div>
        <div className="flex justify-between gap-2 font-semibold">
          <dt title="Cobrado − costos pagados">Margen real</dt>
          <dd className={`tabular-nums ${margenes.margenReal < 0 ? "text-[var(--fo-danger)]" : ""}`}>{pesosPedido(margenes.margenReal)}</dd>
        </div>
      </dl>

      {cuentas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">El pedido no tiene costos cargados.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {cuentas.map((c) => (
            <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[var(--fo-text)]">
                  {c.concepto}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(COLOR_ESTADO_CUENTA[c.estado])}`}>
                    {ETIQUETA_ESTADO_CUENTA[c.estado]}
                  </span>
                </span>
                <span className="tabular-nums text-[var(--fo-text)]">{pesosPedido(c.importe)}</span>
              </div>
              <p className="text-xs text-[var(--fo-muted)]">
                {c.proveedor ?? "Sin proveedor"} · {c.vence ? `Vence ${fechaCorta(c.vence)}` : "Sin vencimiento"}
                {c.rubro ? ` · ${c.rubro}` : ""}
                {c.pagadaEl ? ` · Pagada el ${fechaHoraBA(c.pagadaEl)}` : ""}
                {c.pagadaEl && c.medio ? ` · ${esMedioCobro(c.medio) ? ETIQUETA_MEDIO_COBRO[c.medio] : c.medio}` : ""}
                {c.pagadaEl && c.comprobante ? ` · Comprobante: ${c.comprobante}` : ""}
              </p>
              {c.pagoAnuladoEl ? (
                <p className="text-xs text-[var(--fo-muted)]">
                  Pago anulado el {fechaHoraBA(c.pagoAnuladoEl)}
                  {c.motivoAnulacion ? `: ${c.motivoAnulacion}` : ""}
                </p>
              ) : null}
              {editable ? (
                <div className="flex flex-wrap items-center gap-2">
                  {c.estado === "PAGADA" ? (
                    <button
                      type="button"
                      className="fo-btn fo-btn-danger-outline text-xs"
                      onClick={() => {
                        setAnulando(anulando === c.id ? null : c.id);
                        setMotivo("");
                        setError(null);
                      }}
                      aria-expanded={anulando === c.id}
                    >
                      Anular pago
                    </button>
                  ) : (
                    <>
                      <button type="button" className="fo-btn fo-btn-primary text-xs" onClick={() => setPagando(c)}>
                        Pagar
                      </button>
                      <button
                        type="button"
                        className="fo-btn fo-btn-ghost text-xs"
                        onClick={() => {
                          setError(null);
                          setBorrador({
                            id: c.id,
                            concepto: c.concepto,
                            importe: String(c.importe),
                            vence: c.vence ?? "",
                            proveedor: c.proveedorId ?? "",
                            rubro: c.rubroId ?? "",
                          });
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="fo-btn fo-btn-ghost text-xs"
                        disabled={pendiente}
                        onClick={() => {
                          if (window.confirm(`¿Borrar “${c.concepto}”?`)) correr(() => borrarCuentaPagarAction({ cuentaId: c.id }));
                        }}
                      >
                        Borrar
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              {anulando === c.id ? (
                <form onSubmit={(e) => anular(e, c.id)} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--fo-muted)]">Motivo (obligatorio)</span>
                    <textarea className="fo-input w-full" value={motivo} maxLength={MAX_MOTIVO} onChange={(e) => setMotivo(e.target.value)} required />
                  </label>
                  <p className="text-xs text-[var(--fo-muted)]">Se hace el contramovimiento en Caja y la cuenta vuelve a pendiente.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente}>
                      {pendiente ? "Anulando…" : "Anular pago"}
                    </button>
                    <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setAnulando(null)} disabled={pendiente}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error && !pagando ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-muted)]">
          {aviso}
        </p>
      ) : null}

      {editable && !borrador ? (
        <div className="flex flex-wrap gap-2">
          {!cancelado ? (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setBorrador(VACIO)}>
              Agregar costo
            </button>
          ) : null}
          {!cancelado && cuentas.length === 0 ? (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={generar} disabled={pendiente}>
              {pendiente ? "Generando…" : "Generar costos"}
            </button>
          ) : null}
        </div>
      ) : null}

      {borrador ? (
        <form onSubmit={guardar} className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm">
          <p className="font-medium text-[var(--fo-text)]">{borrador.id ? "Editar costo" : "Agregar costo"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="fo-field-stack sm:col-span-2">
              <span className="fo-label">Concepto</span>
              <input
                className="fo-input"
                value={borrador.concepto}
                maxLength={MAX_CONCEPTO}
                onChange={(e) => setBorrador({ ...borrador, concepto: e.target.value })}
                required
              />
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Importe</span>
              <input
                className="fo-input tabular-nums"
                inputMode="decimal"
                value={borrador.importe}
                onChange={(e) => setBorrador({ ...borrador, importe: e.target.value })}
                required
              />
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Vencimiento (opcional)</span>
              <input type="date" className="fo-input" value={borrador.vence} onChange={(e) => setBorrador({ ...borrador, vence: e.target.value })} />
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Proveedor</span>
              <select className="fo-input" value={borrador.proveedor} onChange={(e) => setBorrador({ ...borrador, proveedor: e.target.value })}>
                <option value="">Sin proveedor</option>
                {proveedoresDeCategoria.length ? (
                  <optgroup label="Proveedores">
                    {proveedoresDeCategoria.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {otrosContactos.length ? (
                  <optgroup label="Otros contactos">
                    {otrosContactos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Rubro de costo (opcional)</span>
              <select className="fo-input" value={borrador.rubro} onChange={(e) => setBorrador({ ...borrador, rubro: e.target.value })}>
                <option value="">Se elige al pagar</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setBorrador(null)} disabled={pendiente}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {pagando ? <PagarCuenta cuenta={pagando} rubros={rubros} hoy={hoy} puedeAdjuntar={puedeAdjuntar} onCerrar={() => setPagando(null)} /> : null}
    </div>
  );
}

/** Diálogo "Pagar": fecha (hoy en Argentina), medio (los 5 de Caja) y rubro de costo obligatorio. */
function PagarCuenta({
  cuenta,
  rubros,
  hoy,
  puedeAdjuntar,
  onCerrar,
}: {
  cuenta: CuentaVista;
  rubros: Opcion[];
  hoy: string;
  puedeAdjuntar: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [clave] = useState(claveDePago);
  const [fecha, setFecha] = useState(hoy);
  const [medio, setMedio] = useState<MedioCobro>("TRANSFERENCIA");
  const [rubro, setRubro] = useState(cuenta.rubroId ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [adjunto, setAdjunto] = useState<{ archivo: File; id: string } | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (pendiente) return;
    if (!fecha || fecha > hoy) return setError("La fecha no puede ser posterior a hoy.");
    if (!rubro) return setError("Elegí el rubro de costo.");
    setError(null);
    iniciar(async () => {
      // El comprobante se sube una sola vez, a la ficha del proveedor (si se reintenta, se reusa).
      let adjuntoId: string | null = null;
      if (archivo && puedeAdjuntar && cuenta.proveedorId) {
        if (adjunto && adjunto.archivo === archivo) adjuntoId = adjunto.id;
        else {
          setProgreso(0);
          const s = await subirAdjuntoConId({ tipo: "CLIENTE", id: cuenta.proveedorId }, archivo, setProgreso).catch(() => null);
          setProgreso(null);
          if (!s) return setError(ERROR_CONEXION);
          if (!s.ok) return setError(`No se pudo subir el comprobante: ${s.error}`);
          setAdjunto({ archivo, id: s.id });
          adjuntoId = s.id;
        }
      }
      const r = await pagarCuentaAction({ cuentaId: cuenta.id, fecha, medio, categoryId: rubro, idempotencyKey: clave, adjuntoId }).catch(() => ({
        ok: false as const,
        error: ERROR_CONEXION,
      }));
      if (!r.ok) return setError(r.error);
      ref.current?.close();
      onCerrar();
      router.refresh();
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`pagar-titulo-${cuenta.id}`}
      className="fo-card w-[92vw] max-w-lg p-0 backdrop:bg-black/50"
      onCancel={(ev) => {
        if (pendiente) ev.preventDefault();
      }}
      onClose={onCerrar}
    >
      <form className="space-y-4 p-6" onSubmit={pagar}>
        <div className="space-y-1">
          <h2 id={`pagar-titulo-${cuenta.id}`} className="text-lg font-semibold text-[var(--fo-text)]">
            Pagar
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {cuenta.concepto} · {cuenta.proveedor ?? "Sin proveedor"} · {pesosPedido(cuenta.importe)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <label className="fo-field-stack text-sm sm:col-span-2">
            <span className="fo-label">Rubro de costo</span>
            <select className="fo-input" value={rubro} onChange={(e) => setRubro(e.target.value)} required>
              <option value="">Elegí un rubro</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>
          {puedeAdjuntar && cuenta.proveedorId ? (
            <label className="fo-field-stack text-sm sm:col-span-2">
              <span className="fo-label">Comprobante (opcional)</span>
              <input type="file" className="fo-input" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <span className="text-xs text-[var(--fo-muted)]">Se guarda en la ficha del proveedor.</span>
              {progreso !== null ? <span className="text-xs text-[var(--fo-muted)]">Subiendo… {progreso} %</span> : null}
            </label>
          ) : null}
        </div>
        <p className="text-xs text-[var(--fo-muted)]">El pago sale de Caja como un egreso, en la cuenta que corresponde al medio.</p>
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => ref.current?.close()} disabled={pendiente}>
            Cancelar
          </button>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
            {pendiente ? "Pagando…" : "Registrar pago"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
