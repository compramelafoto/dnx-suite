"use client";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import { cn } from "@/lib/utils";

export type PayoutFieldErrors = {
  payoutAlias?: string;
  payoutBank?: string;
  payoutAccountHolder?: string;
};

type Props = {
  payoutAlias: string;
  payoutBank: string;
  payoutAccountHolder: string;
  loading: boolean;
  saving: boolean;
  isComplete: boolean;
  fieldErrors: PayoutFieldErrors;
  feedback: { type: "success" | "error"; text: string } | null;
  onAliasChange: (value: string) => void;
  onBankChange: (value: string) => void;
  onHolderChange: (value: string) => void;
  onSave: () => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="ds-admin-text text-sm text-red-700 mt-1.5 m-0" role="alert">
      {message}
    </p>
  );
}

function inputClass(hasError: boolean) {
  return cn(hasError && "border-red-400 focus:ring-red-400/80");
}

export default function OrganizerPayoutSettingsSection({
  payoutAlias,
  payoutBank,
  payoutAccountHolder,
  loading,
  saving,
  isComplete,
  fieldErrors,
  feedback,
  onAliasChange,
  onBankChange,
  onHolderChange,
  onSave,
}: Props) {
  return (
    <section
      className="ds-organizer-panel ds-organizer-panel--stack w-full max-w-2xl self-stretch overflow-hidden"
      aria-labelledby="payout-settings-heading"
    >
      <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white rounded-t-[1.4rem] -mx-4 -mt-4 px-4 pt-4 pb-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 sm:pb-5 md:px-6">
        <div className="flex gap-4 items-start min-w-0 w-full">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 ds-stack-anchor"
            aria-hidden
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1 ds-content-container">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 id="payout-settings-heading" className="text-lg font-semibold text-gray-900 m-0">
                Datos para retiros
              </h2>
              {isComplete && !loading ? (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 whitespace-nowrap">
                  Cuenta configurada
                </span>
              ) : null}
            </div>
            <p className="ds-admin-text text-sm text-gray-600 m-0">
              Indicá dónde querés recibir las transferencias de tus comisiones. Los datos se guardan de forma segura en
              tu perfil.
            </p>
          </div>
        </div>
      </div>

      <DsInfoPanel title="Uso de tus datos">
        <p className="ds-admin-text text-sm text-gray-700 m-0">
          Tus datos bancarios sólo se utilizan para enviarte transferencias de comisiones. No se comparten con
          fotógrafos ni compradores.
        </p>
      </DsInfoPanel>

      {loading ? (
        <p className="ds-admin-text text-sm text-gray-600 m-0">Cargando datos bancarios…</p>
      ) : (
        <form
          className="ds-form-stack max-w-none"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          <DsField
            label="Alias, CBU o CVU"
            hint="Alias de Mercado Pago, CBU de 22 dígitos o CVU de billetera virtual."
            htmlFor="profile-payout-alias"
          >
            <Input
              id="profile-payout-alias"
              value={payoutAlias}
              onChange={(e) => onAliasChange(e.target.value)}
              placeholder="ej: club.futbol.mp"
              className={inputClass(Boolean(fieldErrors.payoutAlias))}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.payoutAlias)}
              aria-describedby={fieldErrors.payoutAlias ? "profile-payout-alias-error" : undefined}
            />
          </DsField>
          <FieldError id="profile-payout-alias-error" message={fieldErrors.payoutAlias} />

          <DsField label="Banco o billetera" htmlFor="profile-payout-bank">
            <Input
              id="profile-payout-bank"
              value={payoutBank}
              onChange={(e) => onBankChange(e.target.value)}
              placeholder="ej: Mercado Pago / Banco Galicia"
              className={inputClass(Boolean(fieldErrors.payoutBank))}
              autoComplete="organization"
              aria-invalid={Boolean(fieldErrors.payoutBank)}
              aria-describedby={fieldErrors.payoutBank ? "profile-payout-bank-error" : undefined}
            />
          </DsField>
          <FieldError id="profile-payout-bank-error" message={fieldErrors.payoutBank} />

          <DsField label="Titular de la cuenta" htmlFor="profile-payout-holder">
            <Input
              id="profile-payout-holder"
              value={payoutAccountHolder}
              onChange={(e) => onHolderChange(e.target.value)}
              placeholder="ej: Juan Pérez"
              className={inputClass(Boolean(fieldErrors.payoutAccountHolder))}
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.payoutAccountHolder)}
              aria-describedby={fieldErrors.payoutAccountHolder ? "profile-payout-holder-error" : undefined}
            />
          </DsField>
          <FieldError id="profile-payout-holder-error" message={fieldErrors.payoutAccountHolder} />

          <div className="pt-1 w-full">
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="w-full sm:w-auto min-w-[12rem] whitespace-nowrap"
            >
              {saving ? "Guardando…" : "Guardar datos bancarios"}
            </Button>
          </div>

          {feedback ? (
            <div
              className={cn(
                "rounded-xl border p-3.5 text-sm w-full ds-admin-text",
                feedback.type === "success"
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-red-50 border-red-200 text-red-800"
              )}
              role="status"
            >
              {feedback.text}
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
