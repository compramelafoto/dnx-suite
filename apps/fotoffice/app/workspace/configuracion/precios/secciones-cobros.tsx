"use client";

import { useId, useState } from "react";
import type { CuantoCobroPricingExtras, CuantoCobroTravelZone } from "@repo/cuanto-cobro-core";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { extrasDelPerfil } from "@/lib/precios/perfil-datos";
import { Aviso, type PropsSeccion } from "./secciones";

/**
 * Paso «Impuestos, cobros y recargos» de Configuración → Precios (etapa A, 15/10/2026). Todo es
 * opcional: lo que quede vacío no cambia el precio. Se guarda dentro del perfil (`pricingExtras`).
 */

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-[var(--fo-border)] p-4">
      <legend className="px-1 text-sm font-semibold text-[var(--fo-text)]">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Casilla({ etiqueta, valor, onCambio, ayuda }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void; ayuda?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
        <input id={id} type="checkbox" checked={valor} onChange={(e) => onCambio(e.target.checked)} />
        {etiqueta}
      </label>
      {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </div>
  );
}

function Zonas({ zonas, onCambio }: { zonas: CuantoCobroTravelZone[]; onCambio: (z: CuantoCobroTravelZone[]) => void }) {
  const editar = (id: string, parcial: Partial<CuantoCobroTravelZone>) => onCambio(zonas.map((z) => (z.id === id ? { ...z, ...parcial } : z)));
  return (
    <div className="space-y-3">
      {zonas.map((z) => (
        <div key={z.id} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <CampoTexto etiqueta="Zona" tipo="text" valor={z.name} onCambio={(v) => editar(z.id, { name: v })} />
          <CampoTexto etiqueta="Hasta (km de ida)" valor={z.upToKm} onCambio={(v) => editar(z.id, { upToKm: v })} />
          <CampoTexto tipo="moneda" etiqueta="Cobro" valor={z.amount} onCambio={(v) => editar(z.id, { amount: v })} />
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => onCambio(zonas.filter((x) => x.id !== z.id))}>
            Quitar
          </button>
        </div>
      ))}
      {zonas.length < 20 ? (
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => onCambio([...zonas, { id: `zona-${crypto.randomUUID().slice(0, 8)}`, name: "", upToKm: "", amount: "" }])}
        >
          Agregar zona
        </button>
      ) : null}
    </div>
  );
}

function FeriadosPropios({ fechas, onCambio }: { fechas: string[]; onCambio: (f: string[]) => void }) {
  const [nueva, setNueva] = useState("");
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="fo-label">
        Feriados propios (por ejemplo, un feriado de tu ciudad)
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={id} type="date" className="fo-input max-w-[12rem]" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          disabled={!nueva || fechas.includes(nueva)}
          onClick={() => {
            onCambio([...fechas, nueva].sort());
            setNueva("");
          }}
        >
          Agregar
        </button>
      </div>
      {fechas.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {fechas.map((f) => (
            <li key={f} className="flex items-center gap-1 rounded-full border border-[var(--fo-border)] px-3 py-1">
              {f.split("-").reverse().join("/")}
              <button type="button" className="text-[var(--fo-muted)]" aria-label={`Quitar ${f}`} onClick={() => onCambio(fechas.filter((x) => x !== f))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SeccionCobros({ perfil, cambiar }: PropsSeccion) {
  const e = extrasDelPerfil(perfil);
  const poner = (parcial: Partial<CuantoCobroPricingExtras>) => cambiar({ pricingExtras: { ...e, ...parcial } });
  const idIva = useId();
  const idViaticos = useId();
  const idCancelacion = useId();
  const ri = e.ivaCondition === "responsable_inscripto";
  return (
    <div className="space-y-5">
      <Aviso>
        Todo es opcional. Lo que cargues acá se suma solo al precio de cada presupuesto: primero el costo y tu ganancia, después los
        recargos, y al final los impuestos y la comisión (que se calculan sobre el total que paga el cliente).
      </Aviso>

      <Grupo titulo="Impuestos">
        <div className="fo-field-stack">
          <label htmlFor={idIva} className="fo-label">
            Condición frente al IVA
          </label>
          <select id={idIva} className="fo-input" value={e.ivaCondition} onChange={(x) => poner({ ivaCondition: x.target.value as CuantoCobroPricingExtras["ivaCondition"] })}>
            <option value="">Elegí una opción</option>
            <option value="monotributo">Monotributo</option>
            <option value="responsable_inscripto">Responsable inscripto</option>
            <option value="exento">Exento</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ri ? <CampoTexto etiqueta="IVA (%)" valor={e.ivaPercent} onCambio={(v) => poner({ ivaPercent: v })} ayuda="Vacío: 21 %. Se muestra aparte en el presupuesto." /> : null}
          {!ri ? (
            <CampoTexto tipo="moneda" etiqueta="Cuota mensual del monotributo" valor={e.monotributoMonthly} onCambio={(v) => poner({ monotributoMonthly: v })} ayuda="Es un costo fijo: sube tu valor hora." />
          ) : null}
          <CampoTexto
            etiqueta="Ingresos Brutos (%)"
            valor={e.grossIncomePercent}
            onCambio={(v) => poner({ grossIncomePercent: v })}
            ayuda="Si pagás IIBB dentro del monotributo (régimen simplificado), dejalo en 0."
          />
        </div>
      </Grupo>

      <Grupo titulo="Cobro">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto etiqueta="Comisión del medio de pago (%)" valor={e.paymentCommissionPercent} onCambio={(v) => poner({ paymentCommissionPercent: v })} ayuda="Lo que te cobra Mercado Pago por cada cobro." />
          <CampoTexto etiqueta="Seña (%)" valor={e.depositPercent} onCambio={(v) => poner({ depositPercent: v })} ayuda="Se calcula sobre el total." />
        </div>
        <Casilla
          etiqueta="Sumar la comisión al precio"
          valor={e.includeCommissionInPrice}
          onCambio={(v) => poner({ includeCommissionInPrice: v })}
          ayuda="A quien pague por transferencia le podés ofrecer un descuento del mismo porcentaje. Consultá con tu contador cómo reflejarlo en la factura."
        />
      </Grupo>

      <Grupo titulo="Recargos">
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoTexto etiqueta="Sábado (%)" valor={e.saturdaySurchargePercent} onCambio={(v) => poner({ saturdaySurchargePercent: v })} />
          <CampoTexto etiqueta="Domingo (%)" valor={e.sundaySurchargePercent} onCambio={(v) => poner({ sundaySurchargePercent: v })} />
          <CampoTexto etiqueta="Feriado (%)" valor={e.holidaySurchargePercent} onCambio={(v) => poner({ holidaySurchargePercent: v })} />
        </div>
        <p className="text-xs text-[var(--fo-muted)]">Si el evento es sábado y feriado a la vez, se aplica el recargo más alto (no se suman). Sólo sobre tus horas, no sobre productos ni gastos.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoTexto etiqueta="Entrega exprés (%)" valor={e.expressSurchargePercent} onCambio={(v) => poner({ expressSurchargePercent: v })} />
          <CampoTexto etiqueta="Días de entrega habituales" valor={e.standardDeliveryDays} onCambio={(v) => poner({ standardDeliveryDays: v })} />
          <CampoTexto etiqueta="Recargo de la hora extra (%)" valor={e.overtimeSurchargePercent} onCambio={(v) => poner({ overtimeSurchargePercent: v })} />
        </div>
        <FeriadosPropios fechas={e.extraHolidays} onCambio={(f) => poner({ extraHolidays: f })} />
      </Grupo>

      <Grupo titulo="Viáticos">
        <div className="fo-field-stack">
          <label htmlFor={idViaticos} className="fo-label">
            Cómo cobrás el viaje
          </label>
          <select id={idViaticos} className="fo-input" value={e.travelMode} onChange={(x) => poner({ travelMode: x.target.value as CuantoCobroPricingExtras["travelMode"] })}>
            <option value="">No lo cobro aparte</option>
            <option value="per_km">Por km recorrido</option>
            <option value="zones">Por zonas</option>
          </select>
        </div>
        {e.travelMode === "per_km" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto tipo="moneda" etiqueta="Valor por km" valor={e.travelPerKm} onCambio={(v) => poner({ travelPerKm: v })} ayuda="Se cuenta ida y vuelta." />
            <CampoTexto etiqueta="Km sin cargo (ida y vuelta)" valor={e.travelFreeKm} onCambio={(v) => poner({ travelFreeKm: v })} />
          </div>
        ) : null}
        {e.travelMode === "zones" ? <Zonas zonas={e.travelZones} onCambio={(z) => poner({ travelZones: z })} /> : null}
        {e.travelMode ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto tipo="text" etiqueta="Latitud del estudio" valor={e.studioLatitude} onCambio={(v) => poner({ studioLatitude: v })} ayuda="Opcional: para calcular la distancia sola." />
            <CampoTexto tipo="text" etiqueta="Longitud del estudio" valor={e.studioLongitude} onCambio={(v) => poner({ studioLongitude: v })} />
          </div>
        ) : null}
      </Grupo>

      <Grupo titulo="Otros">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto tipo="moneda" etiqueta="Seguro del equipo (por año)" valor={e.equipmentInsuranceAnnual} onCambio={(v) => poner({ equipmentInsuranceAnnual: v })} ayuda="Se reparte por mes y sube tu valor hora." />
          <CampoTexto etiqueta="Minutos de retoque por foto" valor={e.retouchMinutesPerPhoto} onCambio={(v) => poner({ retouchMinutesPerPhoto: v })} />
          <CampoTexto tipo="moneda" etiqueta="Precio mínimo por trabajo" valor={e.minimumJobPrice} onCambio={(v) => poner({ minimumJobPrice: v })} ayuda="Te avisa si un presupuesto queda por debajo." />
        </div>
        <Casilla
          etiqueta="Ajustar por inflación los eventos a meses"
          valor={e.inflationEnabled}
          onCambio={(v) => poner({ inflationEnabled: v })}
          ayuda="Sólo sobre el saldo que se cobra más adelante; la seña no se ajusta."
        />
        {e.inflationEnabled ? <CampoTexto etiqueta="Inflación mensual estimada (%)" valor={e.inflationMonthlyPercent} onCambio={(v) => poner({ inflationMonthlyPercent: v })} /> : null}
        <div className="fo-field-stack">
          <label htmlFor={idCancelacion} className="fo-label">
            Política de cancelación
          </label>
          <textarea
            id={idCancelacion}
            className="fo-input min-h-24"
            maxLength={4000}
            value={e.cancellationPolicy}
            onChange={(x) => poner({ cancellationPolicy: x.target.value })}
            placeholder="Por ejemplo: la seña confirma la fecha y no se devuelve si se cancela con menos de 30 días."
          />
        </div>
      </Grupo>
    </div>
  );
}
