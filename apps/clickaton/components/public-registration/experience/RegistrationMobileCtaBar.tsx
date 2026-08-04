"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  label: string;
  busyLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  priceHint?: string | null;
};

/** CTA fijo inferior para uso con una mano en mobile. */
export function RegistrationMobileCtaBar({
  label,
  busyLabel = "Preparando…",
  disabled,
  busy,
  onClick,
  priceHint,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ck-border bg-ck-bg/95 px-4 py-3 backdrop-blur-md lg:hidden safe-area-pb">
      <div className="mx-auto max-w-lg space-y-2">
        <div className="flex items-center gap-3">
          {priceHint ? (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ck-yellow">
              {priceHint}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="min-w-[10rem] flex-1 px-4"
            disabled={disabled || busy}
            loading={busy}
            onClick={onClick}
          >
            {busy ? busyLabel : label}
          </Button>
        </div>
        <p className="text-center text-[10px] leading-snug text-ck-text-muted">
          Podrás revisar todo antes de confirmar.
        </p>
      </div>
    </div>
  );
}
