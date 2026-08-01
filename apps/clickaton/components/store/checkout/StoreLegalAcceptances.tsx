"use client";

import { storeLegalDocuments } from "@/lib/public-store/checkout/legal";

type Props = {
  acceptPurchase: boolean;
  acceptReturns: boolean;
  acceptPrivacy: boolean;
  onChange: {
    purchase: (v: boolean) => void;
    returns: (v: boolean) => void;
    privacy: (v: boolean) => void;
  };
  disabled?: boolean;
};

export function StoreLegalAcceptances({
  acceptPurchase,
  acceptReturns,
  acceptPrivacy,
  onChange,
  disabled,
}: Props) {
  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <legend className="ck-heading-md">Aceptaciones</legend>
      <p className="ck-caption rounded-[var(--ck-radius-md)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] px-4 py-3 text-ck-text">
        Textos provisionales — pendiente de revisión legal. Acción legal requerida antes de
        producción.
      </p>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5"
          checked={acceptPurchase}
          onChange={(e) => onChange.purchase(e.target.checked)}
          required
        />
        <span className="ck-body-sm text-ck-text">
          Acepto los{" "}
          <a
            href={storeLegalDocuments.purchaseTerms.href}
            className="text-ck-yellow underline"
            target="_blank"
            rel="noreferrer"
          >
            {storeLegalDocuments.purchaseTerms.label}
          </a>{" "}
          <span className="text-ck-text-muted">
            ({storeLegalDocuments.purchaseTerms.status})
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5"
          checked={acceptReturns}
          onChange={(e) => onChange.returns(e.target.checked)}
          required
        />
        <span className="ck-body-sm text-ck-text">
          Acepto la{" "}
          <a
            href={storeLegalDocuments.returns.href}
            className="text-ck-yellow underline"
            target="_blank"
            rel="noreferrer"
          >
            {storeLegalDocuments.returns.label}
          </a>{" "}
          <span className="text-ck-text-muted">({storeLegalDocuments.returns.status})</span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5"
          checked={acceptPrivacy}
          onChange={(e) => onChange.privacy(e.target.checked)}
          required
        />
        <span className="ck-body-sm text-ck-text">
          Acepto la{" "}
          <a
            href={storeLegalDocuments.privacy.href}
            className="text-ck-yellow underline"
            target="_blank"
            rel="noreferrer"
          >
            {storeLegalDocuments.privacy.label}
          </a>{" "}
          <span className="text-ck-text-muted">({storeLegalDocuments.privacy.status})</span>
        </span>
      </label>
    </fieldset>
  );
}
