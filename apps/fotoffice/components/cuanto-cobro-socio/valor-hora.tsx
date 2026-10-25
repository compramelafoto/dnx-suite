"use client";

import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { parseCuantoCobroAmount } from "@repo/cuanto-cobro-core";
import { enPesos } from "@/lib/precios/pesos";
import { resumirPerfil } from "@/lib/precios/resumen";

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "border-t border-[var(--fo-border)] pt-2 font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-[var(--fo-muted)]"}>{etiqueta}</dt>
      <dd className="whitespace-nowrap tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * El paso «El valor de tu hora»: la cuenta del artículo, con los números de quien la hace. Lo que
 * necesitás ganar por mes, dividido por las horas que cobrás.
 */
export function SeccionValorHora({ perfil }: { perfil: CuantoCobroProfileInput }) {
  const r = resumirPerfil(perfil);
  const otrosIngresos = perfil.livesOnlyFromPhotography === "no" ? parseCuantoCobroAmount(perfil.externalMonthlyIncome) ?? 0 : 0;
  const horas = Math.round(r.horasFacturablesMes * 10) / 10;

  return (
    <div className="space-y-5">
      <dl className="space-y-2 text-sm">
        <Fila etiqueta="Para vivir" valor={enPesos(r.gastosPersonales)} />
        <Fila etiqueta="Gastos fijos del trabajo" valor={enPesos(r.gastosNegocio)} />
        {r.reservas > 0 ? <Fila etiqueta="Equipo, fondo de emergencia y ahorro" valor={enPesos(r.reservas)} /> : null}
        {otrosIngresos > 0 ? <Fila etiqueta="Menos lo que ganás fuera de la fotografía" valor={`− ${enPesos(otrosIngresos)}`} /> : null}
        <Fila etiqueta="Necesitás ganar por mes" valor={enPesos(r.necesidadMensual)} fuerte />
        <Fila etiqueta="Horas que cobrás por mes" valor={`${horas.toLocaleString("es-AR")} h`} />
      </dl>

      <div role="status" className="rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-surface-muted)] p-4">
        <p className="text-sm text-[var(--fo-muted)]">El valor de tu hora</p>
        <p className="text-2xl font-bold tabular-nums text-[var(--fo-accent)]">{r.valorHora === null ? "—" : enPesos(r.valorHora)}</p>
        <p className="mt-1 text-sm text-[var(--fo-muted)]">
          {r.valorHora === null
            ? "Para calcularlo faltan tus horas: completá el paso «Tus horas»."
            : `${enPesos(r.necesidadMensual)} ÷ ${horas.toLocaleString("es-AR")} horas. Cobrar menos por hora es pagar para trabajar.`}
        </p>
      </div>

      {r.faltan.length > 0 ? (
        <div className="rounded-xl border border-[var(--fo-border)] p-4 text-sm">
          <p className="font-medium">Todavía falta completar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
            {r.faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-[var(--fo-muted)]">
        Editar, responder mensajes, vender y llevar las cuentas también es trabajo, pero no se lo cobrás a nadie por separado: lo paga la hora que sí
        cobrás. Por eso la hora de cobertura vale más de lo que parece.
      </p>
    </div>
  );
}
