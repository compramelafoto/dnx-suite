"use client";

import { useActionState, useMemo, useState } from "react";
import { AdminForm, AdminFormFullWidth } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";

type Props = {
  action: (
    prev: CatalogActionState | undefined,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  stock: number;
  reservedStock: number;
  availableStock: number;
  variantName: string;
  onCancel?: () => void;
};

export function StockAdjustForm({
  action,
  stock,
  reservedStock,
  availableStock,
  variantName,
  onCancel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [mode, setMode] = useState<"absolute" | "delta">("absolute");
  const [newStock, setNewStock] = useState(String(stock));
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");

  const preview = useMemo(() => {
    if (mode === "absolute") {
      const n = Number.parseInt(newStock, 10);
      return Number.isFinite(n) ? n : null;
    }
    const d = Number.parseInt(delta, 10);
    return Number.isFinite(d) ? stock + d : null;
  }, [mode, newStock, delta, stock]);

  const reduces =
    preview != null && preview < stock;
  const belowReserved =
    preview != null && preview < reservedStock;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />

      {state?.message && !state.ok ? (
        <p
          className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title={`Ajustar stock — ${variantName}`}
        description="No edita el reservado. El disponible MVP es stock − reservado. Motivo obligatorio (auditoría)."
        footer={
          <>
            {onCancel ? (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={pending || !reason.trim() || belowReserved}
            >
              Confirmar ajuste
            </Button>
          </>
        }
      >
        <AdminFormFullWidth>
          <dl className="grid gap-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-bg/40 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ck-text-secondary">Stock total</dt>
              <dd className="text-lg font-semibold text-ck-text">{stock}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Reservado</dt>
              <dd className="text-lg font-semibold text-ck-text">{reservedStock}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Disponible</dt>
              <dd className="text-lg font-semibold text-ck-text">{availableStock}</dd>
            </div>
          </dl>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <fieldset className="space-y-3">
            <legend className="ck-label text-ck-text">Modalidad</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modeChoice"
                checked={mode === "absolute"}
                onChange={() => setMode("absolute")}
              />
              Establecer total (newStock)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modeChoice"
                checked={mode === "delta"}
                onChange={() => setMode("delta")}
              />
              Sumar / restar (delta)
            </label>
          </fieldset>
        </AdminFormFullWidth>

        {mode === "absolute" ? (
          <Field
            id="newStock"
            label="Nuevo stock total"
            required
            error={state?.errors?.newStock}
            hint={`Mínimo permitido por reservado: ${reservedStock}.`}
          >
            <Input
              name="newStock"
              inputMode="numeric"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
            />
          </Field>
        ) : (
          <Field
            id="delta"
            label="Delta (+/−)"
            required
            error={state?.errors?.delta}
            hint="Ej. 10 suma; -5 resta. El resultado no puede ser negativo ni menor al reservado."
          >
            <Input
              name="delta"
              inputMode="numeric"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </Field>
        )}

        <AdminFormFullWidth>
          <Field
            id="reason"
            label="Motivo"
            required
            error={state?.errors?.reason}
            hint="Obligatorio para auditoría estructurada."
          >
            <textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
            />
          </Field>
        </AdminFormFullWidth>

        {preview != null ? (
          <AdminFormFullWidth>
            <p className="text-sm text-ck-text-secondary">
              Resultado preview: <strong className="text-ck-text">{preview}</strong>
              {reduces ? " — estás reduciendo stock." : null}
            </p>
            {reduces ? (
              <p className="mt-2 text-sm text-[var(--ck-warning)]" role="status">
                Advertencia: reducir stock puede afectar entregas futuras si hay demanda.
              </p>
            ) : null}
            {belowReserved ? (
              <p className="mt-2 text-sm text-[var(--ck-danger)]" role="alert">
                El nuevo stock quedaría por debajo de lo reservado ({reservedStock}). El backend
                lo rechazará.
              </p>
            ) : null}
          </AdminFormFullWidth>
        ) : null}
      </AdminForm>
    </form>
  );
}
