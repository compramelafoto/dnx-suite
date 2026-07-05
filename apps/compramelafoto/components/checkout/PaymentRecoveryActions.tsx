"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";

type Props = {
  orderId: number;
  orderType?: string;
  /** Ruta al álbum o inicio */
  backHref?: string;
  backLabel?: string;
  canRetry?: boolean;
  buyerEmail?: string;
  onBuyerEmailChange?: (email: string) => void;
  retryRequiresEmail?: boolean;
  onRetry: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  retrying?: boolean;
  refreshing?: boolean;
  retryError?: string | null;
  emailError?: string | null;
  onVerifyEmail?: () => void | Promise<void>;
  showRefresh?: boolean;
  className?: string;
};

export default function PaymentRecoveryActions({
  orderId,
  orderType = "ALBUM_ORDER",
  backHref = "/",
  backLabel = "Volver al inicio",
  canRetry = true,
  buyerEmail = "",
  onBuyerEmailChange,
  retryRequiresEmail = false,
  onRetry,
  onRefresh,
  retrying = false,
  refreshing = false,
  retryError = null,
  emailError = null,
  onVerifyEmail,
  showRefresh = true,
  className = "",
}: Props) {
  const retryDisabled = retrying || refreshing || !canRetry;
  const refreshDisabled = retrying || refreshing;

  return (
    <div className={`flex flex-col gap-3 w-full min-w-0 ${className}`}>
      {retryRequiresEmail && onBuyerEmailChange ? (
        <div className="space-y-2">
          <p className="text-sm text-[#4b5563]">
            Ingresá el email de tu pedido para reintentar el pago.
          </p>
          <Input
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={buyerEmail}
            onChange={(e) => onBuyerEmailChange(e.target.value)}
            disabled={retrying || refreshing}
          />
          {emailError ? (
            <p className="text-sm text-red-600" role="alert">
              {emailError}
            </p>
          ) : null}
          {onVerifyEmail ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={retrying || refreshing || !!getCheckoutEmailValidationError(buyerEmail)}
              onClick={() => void onVerifyEmail()}
            >
              Confirmar email
            </Button>
          ) : null}
        </div>
      ) : null}

      {retryError ? (
        <p className="text-sm text-red-600" role="alert">
          {retryError}
        </p>
      ) : null}

      {canRetry && !retryRequiresEmail ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          disabled={retryDisabled}
          onClick={() => void onRetry()}
        >
          {retrying ? "Preparando pago…" : "Reintentar pago"}
        </Button>
      ) : null}

      {canRetry && retryRequiresEmail && buyerEmail.trim() && !getCheckoutEmailValidationError(buyerEmail) ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          disabled={retryDisabled}
          onClick={() => void onRetry()}
        >
          {retrying ? "Preparando pago…" : "Reintentar pago"}
        </Button>
      ) : null}

      {showRefresh ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full"
          disabled={refreshDisabled}
          onClick={() => void onRefresh()}
        >
          {refreshing ? "Actualizando estado…" : "Actualizar estado"}
        </Button>
      ) : null}

      <Link href={backHref} className="w-full">
        <Button variant="outline" size="md" className="w-full" disabled={retrying || refreshing}>
          {backLabel}
        </Button>
      </Link>

      <p className="text-xs text-center text-[#9ca3af]">
        Pedido #{orderId}
        {orderType ? ` · ${orderType}` : ""}
      </p>
    </div>
  );
}
