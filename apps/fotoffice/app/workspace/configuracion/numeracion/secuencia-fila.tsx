"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Hash } from "lucide-react";
import { formatearNumero, MAX_PREFIJO } from "@/lib/numeracion/formato";
import { Mensaje } from "../ficha/mensaje";
import { configurarSecuenciaAction, type EstadoNumeracion } from "./actions";

export type SecuenciaVista = {
  clave: string;
  nombre: string;
  prefijo: string;
  conAnio: boolean;
  digitos: number;
  /** El número que va a salir ahora. */
  proximo: number;
  /** 0 si todavía no se usó ninguno (del año corriente si lleva año). */
  ultimoUsado: number;
  /** Vista previa calculada en el servidor (la de la configuración guardada). */
  vistaPrevia: string;
  historial: { id: string; quien: string; cuando: string; cambios: string[] }[];
};

const INICIAL: EstadoNumeracion = { error: null };

/** Vista previa en vivo con lo que está escrito; "—" mientras algo no es válido. */
function previa(prefijo: string, conAnio: boolean, digitos: string, proximo: string, anio: number): string {
  const d = Number(digitos);
  const n = Number(proximo);
  const p = prefijo.trim();
  if (!/^\d+$/.test(digitos.trim()) || d < 1 || d > 8) return "—";
  if (!/^\d+$/.test(proximo.trim()) || n < 1) return "—";
  if (p.length > MAX_PREFIJO || !/^[A-Za-z0-9-]*$/.test(p)) return "—";
  return formatearNumero({ prefix: p, withYear: conAnio, digits: d }, conAnio ? anio : null, n);
}

export function SecuenciaFila({ s, anio }: { s: SecuenciaVista; anio: number }) {
  const [estado, enviar, pendiente] = useActionState(configurarSecuenciaAction, INICIAL);
  const [prefijo, setPrefijo] = useState(s.prefijo);
  const [conAnio, setConAnio] = useState(s.conAnio);
  const [digitos, setDigitos] = useState(String(s.digitos));
  const [proximo, setProximo] = useState(String(s.proximo));
  const id = s.clave.toLowerCase();
  // Sin `action` en el formulario: así React no lo resetea al terminar y los campos quedan como se guardaron.
  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => enviar(fd));
  };
  const bajaDelUsado = /^\d+$/.test(proximo.trim()) && Number(proximo) <= s.ultimoUsado && conAnio === s.conAnio;

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby={`sec-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`sec-${id}`} className="flex items-center gap-2 text-base font-semibold">
          <Hash className="size-4 text-[var(--fo-muted)]" aria-hidden />
          {s.nombre}
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Último usado: {s.ultimoUsado > 0 ? s.ultimoUsado : "ninguno todavía"}
          {s.conAnio && s.ultimoUsado > 0 ? ` (de ${anio})` : ""}
        </p>
      </div>
      <form onSubmit={guardar} className="space-y-3">
        <input type="hidden" name="clave" value={s.clave} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="fo-field-stack w-28">
            <label className="fo-label" htmlFor={`prefijo-${id}`}>
              Prefijo
            </label>
            <input
              id={`prefijo-${id}`}
              name="prefijo"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value)}
              maxLength={MAX_PREFIJO}
              pattern="[A-Za-z0-9\-]*"
              className="fo-input"
              placeholder="P-"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="conAnio" value="1" checked={conAnio} onChange={(e) => setConAnio(e.target.checked)} />
            Con año
          </label>
          <div className="fo-field-stack w-24">
            <label className="fo-label" htmlFor={`digitos-${id}`}>
              Dígitos
            </label>
            <input
              id={`digitos-${id}`}
              name="digitos"
              type="number"
              min={1}
              max={8}
              value={digitos}
              onChange={(e) => setDigitos(e.target.value)}
              required
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack w-36">
            <label className="fo-label" htmlFor={`proximo-${id}`}>
              Próximo número
            </label>
            <input
              id={`proximo-${id}`}
              name="proximo"
              type="number"
              min={1}
              value={proximo}
              onChange={(e) => setProximo(e.target.value)}
              required
              aria-describedby={`previa-${id}`}
              className="fo-input"
            />
          </div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
            Guardar
          </button>
        </div>
        <p id={`previa-${id}`} className="text-sm" aria-live="polite">
          Vista previa del próximo:{" "}
          <strong className="font-mono">{previa(prefijo, conAnio, digitos, proximo, anio)}</strong>
        </p>
        {bajaDelUsado ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            No se puede volver a un número ya usado: el próximo tiene que ser mayor que {s.ultimoUsado}.
          </p>
        ) : null}
        <Mensaje estado={estado} />
      </form>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Historial de cambios ({s.historial.length})
        </summary>
        {s.historial.length === 0 ? (
          <p className="pt-2 text-sm text-[var(--fo-muted)]">Todavía no se cambió.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {s.historial.map((h) => (
              <li key={h.id} className="py-2 text-sm">
                <p className="text-xs text-[var(--fo-muted)]">
                  {h.cuando} · {h.quien}
                </p>
                <ul>
                  {h.cambios.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
