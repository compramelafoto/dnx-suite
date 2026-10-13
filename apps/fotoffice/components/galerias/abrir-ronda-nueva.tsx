"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { abrirRondaNuevaGaleriaAction } from "@/app/actions/galerias";
import { MAX_NOTA_RONDA } from "@/lib/galerias/constantes";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * «Abrir ronda nueva» de un álbum: cierra la ronda actual (queda en sólo lectura) y abre la siguiente, con una nota
 * para el cliente y, si se quiere, con las láminas de la ronda anterior ya copiadas para reemplazar sólo las que
 * cambian. Los clientes vuelven a «eligiendo» y reciben un correo con el enlace. Si ningún cliente decidió sobre la
 * ronda actual, el servidor lo avisa y se puede abrir igual confirmándolo.
 */
export function AbrirRondaNueva({ galeriaId, numeroActual, laminasActuales }: { galeriaId: string; numeroActual: number; laminasActuales: number }) {
  const router = useRouter();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [copiar, setCopiar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinDecision, setSinDecision] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrirRonda(forzar: boolean) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await abrirRondaNuevaGaleriaAction(galeriaId, { nota, copiar, forzar }).catch(() => ({ ok: false as const, error: ERROR_CONEXION, codigo: "GENERICO" as const }));
      if (!r.ok) {
        setSinDecision(r.codigo === "SIN_DECISION");
        return setError(r.error);
      }
      setSinDecision(false);
      setAbierto(false);
      setNota("");
      setAviso(
        `Ronda ${r.numero} abierta.${copiar ? ` Copiamos ${r.copiadas} ${r.copiadas === 1 ? "lámina" : "láminas"}${r.noCopiadas > 0 ? ` y no pudimos copiar ${r.noCopiadas}: subilas de nuevo` : ""}.` : ""} Les avisamos a los clientes por correo.`,
      );
      router.push(`/galerias/${encodeURIComponent(galeriaId)}?tab=fotos`);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div className="space-y-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setAbierto(true)}>
          Abrir ronda nueva
        </button>
        <div aria-live="polite">
          {aviso ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">
              {aviso}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-[var(--fo-border)] p-4"
      aria-labelledby={`${id}-titulo`}
      onSubmit={(e) => {
        e.preventDefault();
        abrirRonda(false);
      }}
    >
      <h3 id={`${id}-titulo`} className="text-sm font-semibold">
        Abrir la ronda {numeroActual + 1}
      </h3>
      <p className="text-xs text-[var(--fo-muted)]">
        La ronda {numeroActual} queda cerrada y en sólo lectura. Los clientes vuelven a revisar y reciben un correo con el enlace.
      </p>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${id}-nota`}>Nota para el cliente (opcional)</label>
        <textarea
          id={`${id}-nota`}
          className="fo-input min-h-24"
          maxLength={MAX_NOTA_RONDA}
          placeholder="Por ejemplo: cambiamos la tapa y corregimos las páginas 4 y 5."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={pendiente}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} disabled={pendiente || laminasActuales < 1} />
        <span>
          Copiar las láminas de la ronda anterior
          <span className="block text-xs text-[var(--fo-muted)]">
            Quedan en el mismo orden en la ronda nueva y después podés borrar, reemplazar o sumar. {laminasActuales < 1 ? "La ronda actual no tiene láminas listas para copiar." : ""}
          </span>
        </span>
      </label>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {sinDecision ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => abrirRonda(true)}>
            {pendiente ? "Abriendo…" : "Abrir igual"}
          </button>
        ) : (
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
            {pendiente ? "Abriendo…" : "Abrir ronda nueva"}
          </button>
        )}
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => { setAbierto(false); setError(null); setSinDecision(false); }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
