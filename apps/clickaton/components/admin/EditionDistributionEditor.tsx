"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FinanceRecipientOption } from "@/lib/admin/edition-finance/infrastructure/list-active-recipients";
import {
  createEditionDraftFormAction,
  updateDraftAllocationsFormAction,
} from "@/lib/admin/edition-finance/actions/edition-finance";

type Row = {
  key: string;
  financialIdentityId: string;
  paymentConnectionId: string;
  sharePercent: string;
};

type Props = {
  editionId: string;
  recipients: FinanceRecipientOption[];
  draftVersionId?: string | null;
  initialRows?: Array<{
    financialIdentityId: string;
    paymentConnectionId: string | null;
    sharePercent: number;
  }>;
};

function newRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    financialIdentityId: "",
    paymentConnectionId: "",
    sharePercent: "",
  };
}

export function EditionDistributionEditor({
  editionId,
  recipients,
  draftVersionId,
  initialRows,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length > 0
      ? initialRows.map((r) => ({
          key: Math.random().toString(36).slice(2),
          financialIdentityId: r.financialIdentityId,
          paymentConnectionId: r.paymentConnectionId ?? "",
          sharePercent: String(r.sharePercent),
        }))
      : [newRow()],
  );

  const total = useMemo(
    () =>
      rows.reduce((s, r) => {
        const n = Number(r.sharePercent);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0),
    [rows],
  );

  const ids = rows.map((r) => r.financialIdentityId).filter(Boolean);
  const hasDup = new Set(ids).size !== ids.length;
  const sumOk = Math.abs(total - 100) < 0.0001;
  const canSubmit =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.financialIdentityId &&
        r.paymentConnectionId &&
        Number(r.sharePercent) > 0,
    ) &&
    sumOk &&
    !hasDup;

  const allocationsJson = JSON.stringify(
    rows.map((r, index) => ({
      financialIdentityId: r.financialIdentityId,
      paymentConnectionId: r.paymentConnectionId || null,
      sharePercent: Number(r.sharePercent),
      sortOrder: (index + 1) * 10,
      role: "ORGANIZER",
    })),
  );

  const action = draftVersionId
    ? updateDraftAllocationsFormAction.bind(null, editionId)
    : createEditionDraftFormAction.bind(null, editionId);

  return (
    <form
      action={action}
      className="min-w-0 space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4 sm:p-5"
    >
      {draftVersionId ? (
        <input type="hidden" name="versionId" value={draftVersionId} />
      ) : (
        <input type="hidden" name="name" value="Distribución edición" />
      )}
      <input type="hidden" name="allocationsJson" value={allocationsJson} />

      <p className="text-sm leading-relaxed text-ck-text-secondary">
        Elegí la cuenta receptora y el porcentaje que recibirá. La suma debe ser exactamente
        100 %. Para publicar, cada cuenta necesita Mercado Pago conectado y autorizado.
      </p>
      {!sumOk ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="status">
          La distribución debe sumar 100 % antes de habilitar los cobros.
        </p>
      ) : null}

      <ul className="space-y-4">
        {rows.map((row, idx) => {
          const recipient = recipients.find(
            (r) => r.financialIdentityId === row.financialIdentityId,
          );
          return (
            <li
              key={row.key}
              className="grid min-w-0 gap-3 rounded border border-ck-border/70 p-3 md:grid-cols-[2fr_2fr_1fr_auto]"
            >
              <label className="block space-y-2 text-sm">
                <span className="text-ck-text-secondary">Cuenta receptora</span>
                <select
                  className="block min-h-11 w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
                  value={row.financialIdentityId}
                  onChange={(e) => {
                    const financialIdentityId = e.target.value;
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === idx
                          ? {
                              ...r,
                              financialIdentityId,
                              paymentConnectionId:
                                recipients
                                  .find((x) => x.financialIdentityId === financialIdentityId)
                                  ?.accounts.find((a) => a.canReceive)?.id ?? "",
                            }
                          : r,
                      ),
                    );
                  }}
                  required
                >
                  <option value="">Elegí cuenta</option>
                  {recipients.map((r) => (
                    <option key={r.financialIdentityId} value={r.financialIdentityId}>
                      {r.label}
                      {r.emailMasked ? ` · ${r.emailMasked}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-ck-text-secondary">Cuenta de Mercado Pago</span>
                <select
                  className="block min-h-11 w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
                  value={row.paymentConnectionId}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, paymentConnectionId: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value="">Elegí cuenta conectada</option>
                  {(recipient?.accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id} disabled={a.status !== "ACTIVE"}>
                      {a.label}
                      {a.status === "ACTIVE" ? "" : " · no disponible"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-ck-text-secondary">Participación (%)</span>
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  className="block min-h-11 w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
                  value={row.sharePercent}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, sharePercent: e.target.value } : r,
                      ),
                    )
                  }
                  required
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full md:w-auto"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Quitar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => setRows((p) => [...p, newRow()])}
        >
          Agregar cuenta
        </Button>
        <p className={`text-sm font-semibold ${sumOk ? "text-emerald-400" : "text-amber-400"}`}>
          Total: {total.toFixed(2)} %
        </p>
        {hasDup ? (
          <p className="text-sm text-red-400">No se puede duplicar la misma cuenta.</p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="secondary"
        disabled={!canSubmit}
        className="min-h-11 w-full sm:w-auto"
      >
        {draftVersionId ? "Guardar configuración" : "Crear borrador de distribución"}
      </Button>
    </form>
  );
}
