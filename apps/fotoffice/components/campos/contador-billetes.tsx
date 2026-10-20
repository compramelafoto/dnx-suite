"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { InputMoneda } from "@/components/campos/input-moneda";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import { BILLETES_PESOS, totalDelConteoMinor, type ConteoBilletes } from "@/lib/cash/billetes";

function aTexto(minor: number): string {
  return formatMinorArs(minor).replace("$", "").trim();
}

/**
 * Un importe de efectivo con su contador de billetes: cuántos hay de cada uno y el total sale
 * solo. El importe se puede escribir igual a mano; contar lo reemplaza. Va en el formulario de
 * abrir y de cerrar el turno, con el mismo `name` que tenía el campo suelto.
 */
export function ImporteConContador({
  id,
  name,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [conteo, setConteo] = useState<ConteoBilletes>({});
  const [suelto, setSuelto] = useState("");

  function recalcular(nuevo: ConteoBilletes, sueltoTexto: string) {
    const total = totalDelConteoMinor(nuevo, parseArsToMinor(sueltoTexto) ?? 0);
    setTexto(total > 0 ? aTexto(total) : "");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <InputMoneda
          id={id}
          name={name}
          value={texto}
          onChange={setTexto}
          placeholder={placeholder}
          required={required}
          wrapperClassName="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="fo-btn fo-btn-secondary shrink-0 gap-1.5 px-3 text-sm"
          title="Contar billete por billete"
        >
          <Calculator className="size-4" aria-hidden />
          Contar
        </button>
      </div>

      {abierto ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] p-3">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
            {[...BILLETES_PESOS].reverse().map((billete) => {
              const cantidad = conteo[billete] ?? 0;
              return (
                <div key={billete} className="contents">
                  <span className="w-20 tabular-nums text-[var(--fo-muted)]">{formatMinorArs(billete * 100).replace(",00", "")}</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={cantidad === 0 ? "" : cantidad}
                    placeholder="0"
                    onChange={(e) => {
                      const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                      const nuevo = { ...conteo, [billete]: n };
                      setConteo(nuevo);
                      recalcular(nuevo, suelto);
                    }}
                    className="fo-input h-8 w-full text-right tabular-nums"
                    aria-label={`Cantidad de billetes de ${billete} pesos`}
                  />
                  <span className="w-24 text-right tabular-nums text-[var(--fo-text-secondary)]">
                    {cantidad > 0 ? formatMinorArs(cantidad * billete * 100) : "—"}
                  </span>
                </div>
              );
            })}
            <span className="w-20 text-[var(--fo-muted)]">Monedas u otro</span>
            <InputMoneda
              value={suelto}
              onChange={(v) => {
                setSuelto(v);
                recalcular(conteo, v);
              }}
              placeholder="0"
              className="fo-input h-8 text-right text-sm"
              aria-label="Monedas u otro efectivo"
            />
            <span />
          </div>
          <div className="flex items-baseline justify-between border-t border-[var(--fo-border)] pt-2">
            <span className="text-sm text-[var(--fo-muted)]">Total contado</span>
            <span className="text-lg font-semibold tabular-nums">{texto ? `$ ${texto}` : "$ 0,00"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
