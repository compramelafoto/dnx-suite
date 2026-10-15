"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { InputMoneda } from "@/components/campos/input-moneda";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import {
  CANTIDAD_MAXIMA,
  DENOMINACIONES,
  leerCantidad,
  resumenArqueo,
  sumarConteo,
  type Conteo,
  type Denominacion,
} from "@/lib/cash/contador-billetes";
import { cerrarConContadorAction, type EstadoContador } from "./actions";

/** Qué denominaciones esconde cada dispositivo. Es una comodidad de pantalla, no un dato. */
const CLAVE_OCULTAS = "fo-caja-contador-ocultas";
const EVENTO_OCULTAS = "fo-caja-contador-ocultas-cambio";

function leerOcultasCrudo(): string {
  try {
    return window.localStorage.getItem(CLAVE_OCULTAS) ?? "[]";
  } catch {
    // Sin almacenamiento (modo privado): se ven todas.
    return "[]";
  }
}

function suscribirOcultas(avisar: () => void): () => void {
  window.addEventListener(EVENTO_OCULTAS, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_OCULTAS, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function parsearOcultas(crudo: string): string[] {
  try {
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pesos(d: Denominacion): string {
  return `$ ${d.pesos.toLocaleString("es-AR")}`;
}

function FilaDenominacion({
  d,
  cantidad,
  onCambiar,
  editando,
  oculta,
  onAlternarOculta,
}: {
  d: Denominacion;
  cantidad: number;
  onCambiar: (n: number) => void;
  editando: boolean;
  oculta: boolean;
  onAlternarOculta: () => void;
}) {
  if (oculta && !editando) return null;
  const subtotal = cantidad * d.pesos * 100;
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[7rem_auto_minmax(0,1fr)] ${
        oculta ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {editando ? (
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={!oculta}
            onChange={onAlternarOculta}
            aria-label={`Mostrar ${d.tipo === "BILLETE" ? "billete" : "moneda"} de ${pesos(d)}`}
          />
        ) : null}
        <span className="whitespace-nowrap text-lg font-semibold tabular-nums">{pesos(d)}</span>
      </div>
      <div className="flex items-center gap-1.5 justify-self-end sm:justify-self-start">
        <button
          type="button"
          className="h-12 w-12 shrink-0 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-2xl font-semibold leading-none disabled:opacity-40"
          onClick={() => onCambiar(Math.max(0, cantidad - 1))}
          disabled={cantidad === 0 || oculta}
          aria-label={`Uno menos de ${pesos(d)}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className="fo-input h-12 !w-16 shrink-0 text-center text-xl font-semibold tabular-nums sm:!w-20"
          value={cantidad === 0 ? "" : String(cantidad)}
          placeholder="0"
          disabled={oculta}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onCambiar(leerCantidad(e.currentTarget.value.replace(/\D/g, "")))}
          aria-label={`Cantidad de ${d.tipo === "BILLETE" ? "billetes" : "monedas"} de ${pesos(d)}`}
        />
        <button
          type="button"
          className="h-12 w-12 shrink-0 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-2xl font-semibold leading-none disabled:opacity-40"
          onClick={() => onCambiar(Math.min(CANTIDAD_MAXIMA, cantidad + 1))}
          disabled={oculta}
          aria-label={`Uno más de ${pesos(d)}`}
        >
          +
        </button>
      </div>
      <span
        className={`col-span-2 text-right text-sm tabular-nums sm:col-span-1 ${
          cantidad > 0 ? "text-[var(--fo-text)]" : "text-[var(--fo-muted-soft)]"
        }`}
      >
        {formatMinorArs(subtotal)}
      </span>
    </li>
  );
}

function BotonConfirmar({ conTurno }: { conTurno: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="fo-btn fo-btn-primary h-12 w-full text-base" disabled={pending}>
      {pending ? "Guardando…" : conTurno ? "Cerrar turno con este conteo" : "Guardar arqueo"}
    </button>
  );
}

/**
 * El contador de billetes del cierre.
 *
 * Suma en vivo para que se vea; el servidor vuelve a sumar con las mismas cantidades y
 * decide (`cerrarConContadorAction`). Los errores vuelven como estado y no como redirect,
 * así no se pierde lo contado.
 */
export function ContadorBilletes({
  accountId,
  esVault,
  conTurno,
  esperadoMinor,
  cambioInicialMinor,
  cajaFuerteNombre,
}: {
  accountId: string;
  esVault: boolean;
  conTurno: boolean;
  esperadoMinor: number;
  cambioInicialMinor: number;
  cajaFuerteNombre: string | null;
}) {
  const [estado, accion] = useActionState<EstadoContador, FormData>(cerrarConContadorAction, { error: null });
  const [conteo, setConteo] = useState<Conteo>({});
  const [cambioTexto, setCambioTexto] = useState(String(Math.trunc(cambioInicialMinor / 100)));
  const [nota, setNota] = useState("");
  const [registrarAjuste, setRegistrarAjuste] = useState(true);
  const [pasar, setPasar] = useState(true);
  const ocultasCrudo = useSyncExternalStore(suscribirOcultas, leerOcultasCrudo, () => "[]");
  const ocultas = useMemo(() => parsearOcultas(ocultasCrudo), [ocultasCrudo]);
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function alternarOculta(id: string) {
    const nuevo = ocultas.includes(id) ? ocultas.filter((x) => x !== id) : [...ocultas, id];
    try {
      window.localStorage.setItem(CLAVE_OCULTAS, JSON.stringify(nuevo));
    } catch {
      // No se pudo recordar en este dispositivo.
    }
    window.dispatchEvent(new Event(EVENTO_OCULTAS));
    // Lo que se esconde deja de contar: si no, sumaría algo que no se ve.
    setConteo((prev) => {
      if (!prev[id]) return prev;
      const resto = { ...prev };
      delete resto[id];
      return resto;
    });
  }

  const total = useMemo(() => sumarConteo(conteo), [conteo]);
  const cambioMinor = esVault ? total.totalMinor : (parseArsToMinor(cambioTexto) ?? 0);
  const resumen = resumenArqueo({ contadoMinor: total.totalMinor, esperadoMinor, cambioMinor });
  const diferencia = resumen.diferenciaMinor ?? 0;

  const billetes = DENOMINACIONES.filter((d) => d.tipo === "BILLETE");
  const monedas = DENOMINACIONES.filter((d) => d.tipo === "MONEDA");

  const colorDiferencia =
    resumen.estado === "CUADRA"
      ? "text-[var(--fo-success)]"
      : resumen.estado === "SOBRANTE"
        ? "text-[var(--fo-warning)]"
        : "text-[var(--fo-danger)]";
  const fondoDiferencia =
    resumen.estado === "CUADRA"
      ? "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)]"
      : resumen.estado === "SOBRANTE"
        ? "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)]"
        : "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)]";
  const textoDiferencia =
    resumen.estado === "CUADRA"
      ? "Cuadra"
      : resumen.estado === "SOBRANTE"
        ? `Sobran ${formatMinorArs(diferencia)}`
        : `Faltan ${formatMinorArs(-diferencia)}`;

  function textoResumen(): string {
    const lineas = total.lineas.map((l) => `${l.cantidad} × ${pesos(l)} = ${formatMinorArs(l.subtotalMinor)}`);
    return [
      `Arqueo ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`,
      ...lineas,
      `Contado: ${formatMinorArs(total.totalMinor)}`,
      `Esperado: ${formatMinorArs(esperadoMinor)}`,
      `Diferencia: ${textoDiferencia}`,
      ...(esVault ? [] : [`Cambio: ${formatMinorArs(cambioMinor)}`, `A caja fuerte: ${formatMinorArs(resumen.aCajaFuerteMinor)}`]),
    ].join("\n");
  }

  async function compartir() {
    const texto = textoResumen();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Cancelado o sin permiso: no pasa nada.
    }
  }

  return (
    <form action={accion} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="cantidades" value={JSON.stringify(conteo)} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Billetes</h2>
          <div className="flex gap-2">
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setEditando((v) => !v)}>
              {editando ? "Listo" : "Elegir billetes"}
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-sm"
              onClick={() => setConteo({})}
              disabled={total.lineas.length === 0}
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
        {editando ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Destildá los que no usás: dejan de aparecer en este dispositivo.
          </p>
        ) : null}
        <ul className="divide-y divide-[var(--fo-border)] rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
          {billetes.map((d) => (
            <FilaDenominacion
              key={d.id}
              d={d}
              cantidad={conteo[d.id] ?? 0}
              onCambiar={(n) => setConteo((prev) => ({ ...prev, [d.id]: n }))}
              editando={editando}
              oculta={ocultas.includes(d.id)}
              onAlternarOculta={() => alternarOculta(d.id)}
            />
          ))}
        </ul>
        <p className="text-right text-sm text-[var(--fo-muted)]">
          Suma de billetes: <strong className="tabular-nums text-[var(--fo-text)]">{formatMinorArs(total.billetesMinor)}</strong>
        </p>

        <details className="group" open={total.monedasMinor > 0 || undefined}>
          <summary className="cursor-pointer text-base font-semibold">Monedas (opcional)</summary>
          <ul className="mt-3 divide-y divide-[var(--fo-border)] rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
            {monedas.map((d) => (
              <FilaDenominacion
                key={d.id}
                d={d}
                cantidad={conteo[d.id] ?? 0}
                onCambiar={(n) => setConteo((prev) => ({ ...prev, [d.id]: n }))}
                editando={editando}
                oculta={ocultas.includes(d.id)}
                onAlternarOculta={() => alternarOculta(d.id)}
              />
            ))}
          </ul>
        </details>
      </div>

      <aside className="fo-card space-y-4 p-5 lg:sticky lg:top-4">
        <dl className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-[var(--fo-muted)]">Contado</dt>
            <dd className="whitespace-nowrap text-2xl font-semibold tabular-nums">{formatMinorArs(total.totalMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-[var(--fo-muted)]">
              Esperado según el sistema
              <span className="block text-xs text-[var(--fo-muted-soft)]">
                {conTurno ? "apertura + movimientos del turno" : "saldo del libro"}
              </span>
            </dt>
            <dd className="whitespace-nowrap text-lg tabular-nums">{formatMinorArs(esperadoMinor)}</dd>
          </div>
          <div className={`flex items-baseline justify-between gap-3 rounded-[var(--fo-radius)] border px-3 py-2 ${fondoDiferencia}`}>
            <dt className="text-sm font-medium">Diferencia</dt>
            <dd className={`whitespace-nowrap text-lg font-semibold tabular-nums ${colorDiferencia}`}>{textoDiferencia}</dd>
          </div>
        </dl>

        {!esVault ? (
          <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contador-cambio">
                Dejar de cambio en el mostrador
              </label>
              <InputMoneda
                id="contador-cambio"
                name="cambio"
                value={cambioTexto}
                onChange={setCambioTexto}
                decimales={false}
                className="h-12 text-lg"
              />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--fo-muted)]">A caja fuerte</span>
              <span className="text-2xl font-semibold tabular-nums">{formatMinorArs(resumen.aCajaFuerteMinor)}</span>
            </div>
            {resumen.cambioFaltanteMinor > 0 ? (
              <p className="text-sm text-[var(--fo-warning)]">
                No alcanza para dejar ese cambio: faltan {formatMinorArs(resumen.cambioFaltanteMinor)}.
              </p>
            ) : null}
            {cajaFuerteNombre ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="pasarACajaFuerte"
                  className="mt-0.5 h-5 w-5"
                  checked={pasar}
                  onChange={(e) => setPasar(e.currentTarget.checked)}
                />
                <span>
                  Registrar el pase de {formatMinorArs(resumen.aCajaFuerteMinor)} a {cajaFuerteNombre}
                </span>
              </label>
            ) : (
              <p className="text-xs text-[var(--fo-muted-soft)]">
                No hay una caja fuerte configurada: el pase no se registra.
              </p>
            )}
          </div>
        ) : null}

        {diferencia !== 0 ? (
          <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contador-nota">
                ¿Por qué no cuadra?
              </label>
              <input
                id="contador-nota"
                name="nota"
                className="fo-input h-12"
                placeholder="Vuelto de más, seña sin cargar…"
                value={nota}
                onChange={(e) => setNota(e.currentTarget.value)}
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="registrarAjuste"
                className="mt-0.5 h-5 w-5"
                checked={registrarAjuste}
                onChange={(e) => setRegistrarAjuste(e.currentTarget.checked)}
              />
              <span>
                Registrar el {diferencia > 0 ? "sobrante como ingreso" : "faltante como egreso"} de{" "}
                {formatMinorArs(Math.abs(diferencia))}, para que el libro diga lo que hay
              </span>
            </label>
          </div>
        ) : null}

        {estado.error ? (
          <p className="text-sm text-[var(--fo-danger)]" role="alert">
            {estado.error}
          </p>
        ) : null}

        <BotonConfirmar conTurno={conTurno} />
        <button type="button" className="fo-btn fo-btn-ghost w-full text-sm" onClick={compartir} disabled={total.lineas.length === 0}>
          {copiado ? "Resumen copiado" : "Compartir resumen"}
        </button>
      </aside>

      {/* En el teléfono el resumen queda abajo de todo: esta barra lo trae a la vista mientras se cuenta. */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--fo-border)] bg-[var(--fo-surface)] px-4 py-3 lg:hidden">
        <div>
          <p className="text-xs text-[var(--fo-muted)]">Contado</p>
          <p className="text-xl font-semibold tabular-nums">{formatMinorArs(total.totalMinor)}</p>
        </div>
        <p className={`text-right text-sm font-semibold tabular-nums ${colorDiferencia}`}>{textoDiferencia}</p>
      </div>
    </form>
  );
}
