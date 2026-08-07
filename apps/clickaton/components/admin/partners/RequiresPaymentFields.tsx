"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function RequiresPaymentFields() {
  const [requiresPayment, setRequiresPayment] = useState(false);

  return (
    <div className="space-y-4">
      <Field id="requiresPayment" label="¿Requiere pago?">
        <Select
          name="requiresPayment"
          value={requiresPayment ? "true" : "false"}
          onChange={(e) => setRequiresPayment(e.target.value === "true")}
        >
          <option value="false">No — participación sin cobro</option>
          <option value="true">Sí — registrar términos manuales (sin MP)</option>
        </Select>
      </Field>
      {requiresPayment ? (
        <div className="space-y-4 rounded-lg border border-ck-border p-4">
          <p className="text-sm text-ck-text-muted">
            Solo se guarda la intención de cobro. No se crean links de Mercado Pago, órdenes ni
            recurrencias.
          </p>
          <Field id="paymentMode" label="Modo de pago">
            <Select name="paymentMode" defaultValue="MANUAL">
              <option value="MANUAL">Manual</option>
              <option value="ONE_TIME">Pago único</option>
              <option value="INSTALLMENTS">Cuotas</option>
              <option value="EXTERNAL">Externo</option>
              <option value="RECURRING">Recurrente (solo registro; sin cron)</option>
            </Select>
          </Field>
          <Field id="paymentAmountMinor" label="Monto (centavos, opcional)">
            <Input name="paymentAmountMinor" type="number" min={0} placeholder="Ej. 500000" />
          </Field>
          <Field id="paymentNotes" label="Notas de pago">
            <Textarea name="paymentNotes" rows={2} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
