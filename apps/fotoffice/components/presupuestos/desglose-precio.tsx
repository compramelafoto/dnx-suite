"use client";

import { useId } from "react";
import type { CuantoCobroJobPricingSummary, CuantoCobroPriceBuildUp, CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { extrasDelPerfil } from "@/lib/precios/perfil-datos";
import type { AjustesTrabajo } from "@/lib/presupuestos/panel-cuanto-cobro";
import { useFormatearPesos } from "@/components/campos/formato-pesos";
import { CampoTexto } from "./panel-cuanto-cobro";

/**
 * Precio completo en el editor del presupuesto (etapa A, 15/10/2026): los datos del trabajo que
 * cambian el precio y el desglose que devuelve el motor. Sólo para quien tiene `configurar` (R4).
 */

/** Fecha del evento, exprés, viáticos, seguro del evento y retoque. Se muestra lo que el perfil usa. */
export function CamposAjustes({
  ajustes,
  onCambio,
  perfil,
}: {
  ajustes: AjustesTrabajo;
  onCambio: (a: AjustesTrabajo) => void;
  perfil: CuantoCobroProfileInput;
}) {
  const e = extrasDelPerfil(perfil);
  const idFecha = useId();
  const idZona = useId();
  const idExpres = useId();
  const idComision = useId();
  const set = (k: keyof AjustesTrabajo) => (v: string) => onCambio({ ...ajustes, [k]: v });
  return (
    <fieldset className="grid gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-[var(--fo-text)]">Datos del evento</legend>
      <div className="fo-field-stack">
        <label htmlFor={idFecha} className="fo-label">
          Fecha del evento
        </label>
        <input id={idFecha} type="date" className="fo-input" value={ajustes.fechaEvento} onChange={(x) => onCambio({ ...ajustes, fechaEvento: x.target.value })} />
        <p className="text-xs text-[var(--fo-muted)]">Con la fecha se suman solos los recargos de fin de semana o feriado.</p>
      </div>
      {e.travelMode === "zones" ? (
        <div className="fo-field-stack">
          <label htmlFor={idZona} className="fo-label">
            Zona de viáticos
          </label>
          <select id={idZona} className="fo-input" value={ajustes.zonaId} onChange={(x) => onCambio({ ...ajustes, zonaId: x.target.value })}>
            <option value="">Según la distancia</option>
            {e.travelZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {e.travelMode ? <CampoTexto etiqueta="Distancia de ida (km)" valor={ajustes.distanciaKm} onCambio={set("distanciaKm")} /> : null}
      {e.retouchMinutesPerPhoto.trim() ? <CampoTexto etiqueta="Fotos a retocar" valor={ajustes.fotosRetoque} onCambio={set("fotosRetoque")} /> : null}
      <CampoTexto tipo="moneda" etiqueta="Seguro que pide el lugar" valor={ajustes.seguroEvento} onCambio={set("seguroEvento")} ayuda="Costo del trabajo, sin ganancia." />
      {e.expressSurchargePercent.trim() ? (
        <label htmlFor={idExpres} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
          <input id={idExpres} type="checkbox" checked={ajustes.expres} onChange={(x) => onCambio({ ...ajustes, expres: x.target.checked })} />
          Entrega exprés
        </label>
      ) : null}
      {e.paymentCommissionPercent.trim() && e.includeCommissionInPrice ? (
        <label htmlFor={idComision} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
          <input id={idComision} type="checkbox" checked={ajustes.sinComision} onChange={(x) => onCambio({ ...ajustes, sinComision: x.target.checked })} />
          Este trabajo no suma la comisión del medio de pago
        </label>
      ) : null}
    </fieldset>
  );
}

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={"flex justify-between gap-2" + (fuerte ? " font-semibold text-[var(--fo-text)]" : "")}>
      <dt className={fuerte ? "" : "text-[var(--fo-muted)]"}>{etiqueta}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

const DIA: Record<string, string> = { sunday: "domingo", saturday: "sábado", weekday: "día hábil" };

/** El desglose de un ítem (paso a paso) o el del trabajo entero (varios ítems). */
export function DesglosePrecio({ linea, trabajo }: { linea?: CuantoCobroPriceBuildUp | null; trabajo?: CuantoCobroJobPricingSummary | null }) {
  const pesos = useFormatearPesos();
  const d = linea ?? null;
  const t = trabajo ?? null;
  if (!d && !t) return null;
  const dia = d?.day ? (d.day.dayType === "holiday" ? `feriado (${d.day.holidayName ?? ""})` : DIA[d.day.dayType]) : null;
  const total = t?.total ?? d!.total;
  const sinIva = t?.priceWithoutVat ?? d!.priceWithoutVat;
  const iva = t?.iva ?? d!.iva;
  const deposit = t ? t.deposit : d!.deposit;
  const balance = t?.balance ?? d!.balance;
  const deducciones = (t?.grossIncomeTax ?? d!.grossIncomeTax) + (t?.commission ?? d!.commission);
  const horaExtra = t?.overtimeHourPrice ?? d?.overtimeHourPrice ?? null;
  const descuento = t?.suggestedTransferDiscountPercent ?? d?.suggestedTransferDiscountPercent ?? null;
  const avisos = t?.warnings ?? d?.warnings ?? [];
  const politica = t?.cancellationPolicy ?? d?.cancellationPolicy ?? null;
  const recargo = t?.surchargeAmount ?? d!.surchargeAmount;
  const viaticos = t?.travelCost ?? d?.travel?.cost ?? 0;
  const retoque = t?.retouchPrice ?? d?.retouch?.price ?? 0;
  const seguro = t?.eventInsurance ?? d?.eventInsurance ?? 0;
  const inflacion = t?.inflationAmount ?? d?.inflation?.amount ?? 0;
  return (
    <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm">
      <p className="font-semibold text-[var(--fo-text)]">Precio completo{dia ? ` · ${dia}` : ""}</p>
      <dl className="space-y-1">
        {d ? <Fila etiqueta="Precio del cálculo" valor={pesos(d.basePrice)} /> : null}
        {recargo > 0 ? <Fila etiqueta={d ? `Recargos (${[d.daySurchargePercent ? `día ${d.daySurchargePercent} %` : null, d.expressSurchargePercent ? `exprés ${d.expressSurchargePercent} %` : null].filter(Boolean).join(" + ")})` : "Recargos"} valor={pesos(recargo)} /> : null}
        {retoque > 0 ? <Fila etiqueta={d?.retouch ? `Retoque (${d.retouch.photos} fotos)` : "Retoque"} valor={pesos(retoque)} /> : null}
        {viaticos > 0 ? <Fila etiqueta={d?.travel ? `Viáticos (${d.travel.zoneName ? `${d.travel.zoneName}, ` : ""}${d.travel.km} km)` : "Viáticos"} valor={pesos(viaticos)} /> : null}
        {seguro > 0 ? <Fila etiqueta="Seguro del evento" valor={pesos(seguro)} /> : null}
        {inflacion > 0 ? <Fila etiqueta={d?.inflation ? `Inflación (${d.inflation.months} meses al ${d.inflation.monthlyPercent} %)` : "Ajuste por inflación"} valor={pesos(inflacion)} /> : null}
        {deducciones > 0 ? <Fila etiqueta="Ingresos Brutos y comisión" valor={pesos(deducciones)} /> : null}
        <Fila etiqueta={iva > 0 ? "Precio sin IVA" : "Precio"} valor={pesos(sinIva)} fuerte />
        {iva > 0 ? <Fila etiqueta="IVA" valor={pesos(iva)} /> : null}
        {iva > 0 ? <Fila etiqueta="Total para el cliente" valor={pesos(total)} fuerte /> : null}
        {deposit ? <Fila etiqueta={`Seña (${deposit.percent} %)`} valor={pesos(deposit.amount)} /> : null}
        {deposit ? <Fila etiqueta="Saldo" valor={pesos(balance)} /> : null}
        {horaExtra ? <Fila etiqueta="Hora extra" valor={pesos(horaExtra)} /> : null}
        <Fila etiqueta="Te queda (sin impuestos ni comisión)" valor={pesos(sinIva - deducciones)} />
      </dl>
      {iva > 0 ? <p className="text-xs text-[var(--fo-muted)]">El ítem del presupuesto queda sin IVA; el IVA en los totales llega en la próxima etapa.</p> : null}
      {descuento ? <p className="text-xs text-[var(--fo-muted)]">La comisión está sumada: podés ofrecer un descuento por transferencia del {descuento} %.</p> : null}
      {politica ? <p className="text-xs text-[var(--fo-muted)]">Política de cancelación: {politica}</p> : null}
      {avisos.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fo-warning,#d97706)]">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
