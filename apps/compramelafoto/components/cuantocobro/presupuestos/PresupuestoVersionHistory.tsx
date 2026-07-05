"use client";

import PresupuestoStatusBadge from "@/components/cuantocobro/presupuestos/PresupuestoBadges";
import PresupuestoVersionView from "@/components/cuantocobro/presupuestos/PresupuestoVersionView";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import {
  formatQuoteDateTime,
  formatQuoteMoney,
  formatQuoteVersionLabel,
} from "@/lib/cuantocobro/quote/quote-format";
import type { CuantoCobroQuoteVersionSummaryDto } from "@/lib/cuantocobro/quote/types";
import { useState } from "react";

type Props = {
  quoteId: number;
  quoteNumber: string;
  versions: CuantoCobroQuoteVersionSummaryDto[];
  currentVersionNumber: number;
};

export default function PresupuestoVersionHistory({
  quoteId,
  quoteNumber,
  versions,
  currentVersionNumber,
}: Props) {
  const [viewVersionNumber, setViewVersionNumber] = useState<number | null>(null);

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <>
      <section className="cc-presupuesto-version-history">
        <div className="cc-presupuesto-version-history__head">
          <h3 className="cc-presupuesto-quickview__section-title m-0">Historial de versiones</h3>
          <p className="cc-presupuestos-muted m-0 text-sm">
            Versión actual: {formatQuoteVersionLabel(currentVersionNumber)}
          </p>
        </div>

        <div className="cc-presupuesto-version-history__table-wrap hidden md:block">
          <table className="cc-presupuesto-version-history__table">
            <thead>
              <tr>
                <th>Versión</th>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Recomendado</th>
                <th>Elegido</th>
                <th>Estado</th>
                <th>Comentario</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((version) => (
                <tr key={version.id}>
                  <td>
                    <span className="cc-presupuesto-version-history__version">
                      {formatQuoteVersionLabel(version.versionNumber)}
                      {version.isCurrent ? (
                        <span className="cc-presupuesto-version-history__current">Actual</span>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatQuoteDateTime(version.createdAt)}</td>
                  <td>{version.createdByName ?? "—"}</td>
                  <td>{formatQuoteMoney(version.recommendedPriceCents, version.currency)}</td>
                  <td>{formatQuoteMoney(version.chosenPriceCents, version.currency)}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <PresupuestoStatusBadge status={version.status} archivedAt={null} />
                      {version.isImmutable ? (
                        <span className="cc-presupuesto-version-history__viewed-badge">Visto</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="cc-presupuesto-version-history__comment">
                    {version.comment.trim() || "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cc-presupuestos-link cc-presupuestos-link--button"
                      onClick={() => setViewVersionNumber(version.versionNumber)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cc-presupuesto-version-history__cards md:hidden">
          {sorted.map((version) => (
            <article key={version.id} className="cc-presupuesto-version-history__card">
              <div className="cc-presupuesto-version-history__card-head">
                <strong>{formatQuoteVersionLabel(version.versionNumber)}</strong>
                {version.isCurrent ? (
                  <span className="cc-presupuesto-version-history__current">Actual</span>
                ) : null}
                <PresupuestoStatusBadge status={version.status} archivedAt={null} />
                {version.isImmutable ? (
                  <span className="cc-presupuesto-version-history__viewed-badge">Visto</span>
                ) : null}
              </div>
              {version.isImmutable ? (
                <p className="cc-presupuestos-muted m-0 text-sm">
                  Esta versión ya fue vista. Para cambiarla, creá una nueva versión.
                </p>
              ) : null}
              <p className="cc-presupuestos-muted m-0 text-sm">
                {formatQuoteDateTime(version.createdAt)} · {version.createdByName ?? "—"}
              </p>
              <p className="m-0 text-sm">
                Elegido {formatQuoteMoney(version.chosenPriceCents, version.currency)} · Rec.{" "}
                {formatQuoteMoney(version.recommendedPriceCents, version.currency)}
              </p>
              {version.comment.trim() ? (
                <p className="cc-presupuesto-version-history__comment m-0 text-sm">{version.comment}</p>
              ) : null}
              <CuantoCobroButton
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => setViewVersionNumber(version.versionNumber)}
              >
                Ver versión
              </CuantoCobroButton>
            </article>
          ))}
        </div>
      </section>

      <PresupuestoVersionView
        quoteId={quoteId}
        quoteNumber={quoteNumber}
        versionNumber={viewVersionNumber}
        open={viewVersionNumber != null}
        onClose={() => setViewVersionNumber(null)}
      />
    </>
  );
}
