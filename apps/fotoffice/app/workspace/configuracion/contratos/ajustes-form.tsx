"use client";

import { useState, useTransition } from "react";
import { guardarAjustesContratosAction } from "@/app/actions/contratos";

type Inicial = {
  companyName: string;
  companyTaxId: string;
  companyAddress: string;
  consentClause: string;
  reminderEnabled: boolean;
  reminderDays: number;
};

/**
 * Datos de la empresa, cláusula de consentimiento (firma electrónica) y recordatorio a los firmantes
 * (apagado por omisión). La cláusula se puede restaurar a la de fábrica.
 */
export function AjustesForm({ inicial, clausulaDeFabrica }: { inicial: Inicial; clausulaDeFabrica: string }) {
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState({ ...inicial, reminderDays: String(inicial.reminderDays) });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        const r = await guardarAjustesContratosAction({
          companyName: v.companyName,
          companyTaxId: v.companyTaxId,
          companyAddress: v.companyAddress,
          // Si es igual a la de fábrica no se guarda copia: así acompaña cualquier mejora futura.
          consentClause: v.consentClause.trim() === clausulaDeFabrica ? "" : v.consentClause,
          reminderEnabled: v.reminderEnabled,
          reminderDays: v.reminderDays,
        });
        if (!r.ok) return setError(r.error);
        setOk("Guardado.");
      } catch {
        setError("No pudimos guardar los cambios. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-6" aria-label="Ajustes de contratos">
      <section className="fo-card space-y-4 p-5" aria-labelledby="empresa-titulo">
        <div className="space-y-1">
          <h2 id="empresa-titulo" className="text-base font-semibold">
            Datos de la empresa
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Se completan en los contratos donde pongas <code>[empresa_nombre]</code>, <code>[empresa_cuit]</code> y <code>[empresa_domicilio]</code>.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ct-empresa-nombre">Nombre o razón social</label>
          <input id="ct-empresa-nombre" className="fo-input" maxLength={120} value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} />
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="ct-empresa-cuit">CUIT</label>
          <input id="ct-empresa-cuit" className="fo-input" maxLength={30} value={v.companyTaxId} onChange={(e) => setV({ ...v, companyTaxId: e.target.value })} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ct-empresa-domicilio">Domicilio</label>
          <input id="ct-empresa-domicilio" className="fo-input" maxLength={200} value={v.companyAddress} onChange={(e) => setV({ ...v, companyAddress: e.target.value })} />
        </div>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="clausula-titulo">
        <div className="space-y-1">
          <h2 id="clausula-titulo" className="text-base font-semibold">
            Cláusula de consentimiento
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Es lo que acepta cada firmante antes de firmar. Los contratos se firman con firma electrónica (Ley 25.506): quedan registrados el código
            verificado, la fecha y la hora, y la dirección desde la que se firma.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ct-clausula">Texto</label>
          <textarea
            id="ct-clausula"
            className="fo-input min-h-40"
            maxLength={3000}
            value={v.consentClause}
            onChange={(e) => setV({ ...v, consentClause: e.target.value })}
          />
        </div>
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setV({ ...v, consentClause: clausulaDeFabrica })} disabled={pendiente}>
          Restaurar el texto original
        </button>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="recordatorio-contratos-titulo">
        <div className="space-y-1">
          <h2 id="recordatorio-contratos-titulo" className="text-base font-semibold">
            Recordatorio a los firmantes
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Si un firmante no firma, se le manda un recordatorio por correo pasados los días elegidos desde el envío. El texto se edita en
            Configuración → Plantillas → Automáticos.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.reminderEnabled} onChange={(e) => setV({ ...v, reminderEnabled: e.target.checked })} />
          Activar el recordatorio
        </label>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="ct-recordatorio-dias">Días después del envío</label>
          <input
            id="ct-recordatorio-dias"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            step={1}
            required
            className="fo-input"
            value={v.reminderDays}
            onChange={(e) => setV({ ...v, reminderDays: e.target.value })}
          />
          <p className="text-xs text-[var(--fo-muted)]">De 1 a 30.</p>
        </div>
      </section>

      <div className="space-y-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p>
          ) : ok ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">{ok}</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
