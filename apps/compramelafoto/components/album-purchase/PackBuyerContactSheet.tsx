"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import EmailConfirmationHint, {
  EMAIL_EMPTY_PLACEHOLDER_COPY,
} from "@/components/checkout/EmailConfirmationHint";
import type { AlbumPackBuyerContact } from "@/lib/album-packs/validate-album-pack-buyer-contact";
import { validateAlbumPackBuyerContact } from "@/lib/album-packs/validate-album-pack-buyer-contact";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";

export type PackBuyerContactSheetProps = {
  open: boolean;
  accentColor: string;
  packName: string;
  totalLabel: string;
  loading: boolean;
  initialContact?: Partial<AlbumPackBuyerContact> | null;
  onClose: () => void;
  onSubmit: (contact: AlbumPackBuyerContact) => void;
};

const INPUT_CLASS =
  "block box-border w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-base text-[#111827] placeholder:text-[#9ca3af] sm:text-sm";

export default function PackBuyerContactSheet({
  open,
  accentColor,
  packName,
  totalLabel,
  loading,
  initialContact,
  onClose,
  onSubmit,
}: PackBuyerContactSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [buyerName, setBuyerName] = useState(initialContact?.buyerName ?? "");
  const [buyerEmail, setBuyerEmail] = useState(initialContact?.buyerEmail ?? "");
  const [buyerPhone, setBuyerPhone] = useState(initialContact?.buyerPhone ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setBuyerName(initialContact?.buyerName ?? "");
    setBuyerEmail(initialContact?.buyerEmail ?? "");
    setBuyerPhone(initialContact?.buyerPhone ?? "");
    setError(null);
  }, [open, initialContact?.buyerEmail, initialContact?.buyerName, initialContact?.buyerPhone]);

  if (!mounted || !open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const emailError = getCheckoutEmailValidationError(buyerEmail);
    if (emailError) {
      setError(emailError);
      return;
    }
    try {
      const contact = validateAlbumPackBuyerContact({
        buyerEmail,
        buyerName,
        buyerPhone,
      });
      onSubmit(contact);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revisá los datos e intentá de nuevo.");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] overflow-y-auto overscroll-contain"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="fixed inset-0 z-0 border-0 bg-black/45 p-0"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative z-[1] flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          className="relative box-border flex max-h-[min(92vh,900px)] w-full shrink-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          style={{ width: "min(100vw, 28rem)" }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-buyer-contact-title"
        >
          <form
            onSubmit={handleSubmit}
            className="box-border flex w-full min-w-0 flex-col overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mb-4 min-w-0 space-y-1">
              <h2
                id="pack-buyer-contact-title"
                className="text-base font-semibold text-[#1a1a1a] sm:text-lg"
              >
                Datos para tu compra
              </h2>
              <p className="text-sm leading-relaxed text-[#6b7280]">
                {packName} · {totalLabel}
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="min-w-0">
                <label
                  htmlFor="pack-buyer-name"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  Nombre y apellido
                </label>
                <input
                  id="pack-buyer-name"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="pack-buyer-email"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  Email
                </label>
                <input
                  id="pack-buyer-email"
                  required
                  type="email"
                  inputMode="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Donde te enviamos el comprobante"
                  autoComplete="email"
                  spellCheck={false}
                />
                {!buyerEmail.trim() ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6b7280]">
                    {EMAIL_EMPTY_PLACEHOLDER_COPY.pack}
                  </p>
                ) : null}
                <EmailConfirmationHint
                  email={buyerEmail}
                  variant="pack"
                  onApplySuggestion={setBuyerEmail}
                  className="mt-1.5"
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="pack-buyer-phone"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  WhatsApp / teléfono
                </label>
                <input
                  id="pack-buyer-phone"
                  required
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="WhatsApp o celular"
                  autoComplete="tel"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-4 text-sm font-medium leading-relaxed text-red-600">{error}</p>
            ) : null}

            <div className="mt-5 min-w-0 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Iniciando pago…
                  </>
                ) : (
                  "Continuar al pago"
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="w-full text-center text-xs text-[#6b7280] underline disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
