"use client";

import {
  getEmailSuggestion,
  isLikelyValidEmail,
  normalizeEmail,
} from "@/lib/email-validation";

export type EmailConfirmationVariant = "album" | "print" | "preventa" | "pack";

const VALID_COPY: Record<EmailConfirmationVariant, (email: string) => string> = {
  album: (email) =>
    `📩 Enviaremos tu comprobante y acceso a tus fotos a: ${email}`,
  print: (email) =>
    `📩 Te avisaremos a este email cuando tu pedido esté listo: ${email}`,
  preventa: (email) =>
    `📩 Usaremos este email para enviarte la confirmación y acceder a tu pack: ${email}`,
  pack: (email) =>
    `📩 Usaremos este email para enviarte la confirmación de compra: ${email}`,
};

export const EMAIL_EMPTY_PLACEHOLDER_COPY: Record<EmailConfirmationVariant, string> = {
  album: "📩 Enviaremos tu comprobante y acceso a tus fotos a este email.",
  print: "📩 Te avisaremos a este email cuando tu pedido esté listo.",
  preventa: "📩 Usaremos este email para enviarte la confirmación y acceder a tu pack.",
  pack: "📩 Usaremos este email para enviarte la confirmación de compra.",
};

type EmailConfirmationHintProps = {
  email: string;
  variant: EmailConfirmationVariant;
  /** Email de cuenta cuando el campo está bloqueado por sesión */
  accountEmail?: string | null;
  onApplySuggestion?: (suggestedEmail: string) => void;
  className?: string;
};

export function AccountEmailNotice({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return (
    <p className={`text-sm text-[#374151] ${className}`.trim()}>
      Usaremos el email de tu cuenta: <span className="font-medium">{normalized}</span>
    </p>
  );
}

export default function EmailConfirmationHint({
  email,
  variant,
  accountEmail,
  onApplySuggestion,
  className = "",
}: EmailConfirmationHintProps) {
  if (accountEmail?.trim()) {
    return <AccountEmailNotice email={accountEmail} className={className} />;
  }

  const trimmed = email.trim();
  if (!trimmed) return null;

  const suggestion = getEmailSuggestion(trimmed);
  const valid = isLikelyValidEmail(trimmed);
  const displayEmail = normalizeEmail(trimmed);

  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {valid ? (
        <p className="text-xs text-[#6b7280]">{VALID_COPY[variant](displayEmail)}</p>
      ) : (
        <p className="text-xs text-amber-700">Revisá este email antes de continuar.</p>
      )}
      {suggestion ? (
        <p className="text-xs text-[#6b7280]">
          ¿Quisiste decir{" "}
          {onApplySuggestion ? (
            <button
              type="button"
              onClick={() => onApplySuggestion(suggestion)}
              className="font-medium text-[#c27b3d] underline underline-offset-2 hover:text-[#a0622f]"
            >
              {suggestion}
            </button>
          ) : (
            <span className="font-medium">{suggestion}</span>
          )}
          ?
        </p>
      ) : null}
    </div>
  );
}
