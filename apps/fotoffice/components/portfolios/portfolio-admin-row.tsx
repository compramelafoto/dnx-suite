"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  forcePublishPortfolioAction,
  hidePortfolioAction,
  restorePortfolioAction,
} from "@/app/actions/portfolio-admin";
import { hiddenReasonMessage } from "@/lib/portfolio/visibility-labels";
import type { AdminPortfolioRow } from "@/lib/portfolio/admin-queries";

type Dialogo = "bajar" | "restaurar" | "perdonar" | "quitar-perdon" | null;

const TITULOS: Record<Exclude<Dialogo, null>, string> = {
  bajar: "Bajar este portfolio del sitio",
  restaurar: "Volver a publicarlo",
  perdonar: "Publicar igual, pese a la deuda",
  "quitar-perdon": "Dar de baja la publicación pese a la deuda",
};

const AYUDAS: Record<Exclude<Dialogo, null>, string> = {
  bajar: "Las fotos quedan guardadas; sólo deja de verse en el sitio. El motivo queda en el historial de la persona.",
  restaurar: "Vuelve a verse si cumple el resto de las condiciones.",
  perdonar:
    "No modifica la deuda ni su cuenta: sólo deja de tenerla en cuenta para publicar el portfolio.",
  "quitar-perdon": "Vuelve a aplicarse la condición de cuotas al día.",
};

/**
 * Una fila del listado, con sus dos acciones. Sin `puedeGestionar` (portfolio VIEW) es sólo
 * lectura: no hay columna de acciones.
 *
 * El motivo es obligatorio y el botón no se habilita sin él — la validación también está en el
 * servidor, pero pedirlo acá evita el viaje de ida y vuelta para recibir un "falta el motivo".
 */
export function PortfolioAdminRow({
  fila,
  puedeGestionar,
}: {
  fila: AdminPortfolioRow;
  puedeGestionar: boolean;
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  const bajado = fila.hiddenByAdminAt !== null;
  const trabadaPorDeuda =
    !fila.visibility.visible && fila.visibility.reason === "OVERDUE_DUES";

  async function confirmar() {
    if (!fila.portfolioId) return;
    setGuardando(true);
    setError(null);

    const entrada = { portfolioId: fila.portfolioId, reason: motivo };
    const r =
      dialogo === "bajar"
        ? await hidePortfolioAction(entrada)
        : dialogo === "restaurar"
          ? await restorePortfolioAction(entrada)
          : await forcePublishPortfolioAction({ ...entrada, force: dialogo === "perdonar" });

    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDialogo(null);
    setMotivo("");
    router.refresh();
  }

  function abrir(cual: Exclude<Dialogo, null>) {
    setDialogo(cual);
    setMotivo("");
    setError(null);
  }

  return (
    <tr className="border-t border-[var(--fo-border)] align-top">
      <td className="py-3 pr-4">
        <p className="font-medium">{fila.displayName}</p>
        <p className="text-xs text-[var(--fo-muted)]">N.º {fila.memberNumber}</p>
      </td>

      <td className="py-3 pr-4 text-sm">{fila.photoCount}</td>

      <td className="py-3 pr-4 text-sm">
        <EstadoDeLaFila fila={fila} />
      </td>

      {puedeGestionar ? (
        <td className="py-3">
          {fila.portfolioId === null ? (
            <span className="text-xs text-[var(--fo-muted)]">Todavía no lo armó</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bajado ? (
                <button type="button" onClick={() => abrir("restaurar")} className="fo-btn fo-btn-secondary text-sm">
                  Volver a publicar
                </button>
              ) : (
                <button type="button" onClick={() => abrir("bajar")} className="fo-btn fo-btn-danger-outline text-sm">
                  Bajar del sitio
                </button>
              )}

              {trabadaPorDeuda ? (
                <button type="button" onClick={() => abrir("perdonar")} className="fo-btn fo-btn-secondary text-sm">
                  Publicar igual
                </button>
              ) : null}

              {fila.adminForcePublish ? (
                <button type="button" onClick={() => abrir("quitar-perdon")} className="fo-btn fo-btn-ghost text-sm">
                  Quitar el permiso por deuda
                </button>
              ) : null}
            </div>
          )}

          {dialogo ? (
            <div className="mt-3 space-y-2 rounded border border-[var(--fo-border)] p-3">
              <p className="text-sm font-medium">{TITULOS[dialogo]}</p>
              <p className="text-xs text-[var(--fo-muted)]">{AYUDAS[dialogo]}</p>

              <label className="block text-xs">
                <span className="text-[var(--fo-muted)]">Motivo (obligatorio)</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-2 py-1 text-sm"
                />
              </label>

              {error ? <p className="fo-alert-error text-sm">{error}</p> : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void confirmar()}
                  disabled={guardando || motivo.trim() === ""}
                  className="fo-btn fo-btn-primary text-sm"
                >
                  {guardando ? "Guardando…" : "Confirmar"}
                </button>
                <button type="button" onClick={() => setDialogo(null)} className="fo-btn fo-btn-ghost text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}

/** El estado real, con su motivo. Nunca un "no publicado" pelado que no explique nada. */
function EstadoDeLaFila({ fila }: { fila: AdminPortfolioRow }) {
  if (fila.visibility.visible) {
    return (
      <span className="text-[var(--fo-accent)]">
        Publicado
        {fila.adminForcePublish ? (
          <span className="block text-xs text-[var(--fo-muted)]">
            Publicado pese a la deuda, por decisión de la institución
          </span>
        ) : null}
      </span>
    );
  }

  const mensaje = hiddenReasonMessage(fila.visibility.reason);
  return (
    <span className="text-[var(--fo-muted)]">
      {mensaje.title}
      {fila.hiddenReason ? (
        <span className="block text-xs">
          Motivo: {fila.hiddenReason}
          {fila.hiddenByLabel ? ` — ${fila.hiddenByLabel}` : null}
        </span>
      ) : null}
      {fila.visibility.reason === "OVERDUE_DUES" ? (
        <span className="block text-xs">{fila.overdueCount} cuotas vencidas</span>
      ) : null}
    </span>
  );
}
