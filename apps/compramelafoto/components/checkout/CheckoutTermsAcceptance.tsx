"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type CheckoutTermsAcceptanceProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string | null;
  className?: string;
};

/** Checkbox compacto de T&C + Privacidad para el CTA final del checkout. */
export default function CheckoutTermsAcceptance({
  checked,
  onChange,
  disabled = false,
  error,
  className,
}: CheckoutTermsAcceptanceProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d1d5db] text-[#c27b3d] focus:ring-2 focus:ring-[#c27b3d]"
        />
        <span className="text-sm leading-snug text-[#6b7280]">
          He leído y acepto los{" "}
          <Link
            href="/terminos"
            target="_blank"
            className="font-medium text-[#c27b3d] underline underline-offset-2 hover:text-[#a0662f]"
          >
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-medium text-[#c27b3d] underline underline-offset-2 hover:text-[#a0662f]"
          >
            Política de Privacidad
          </Link>
          .
        </span>
      </label>
      {error ? <p className="text-sm text-[#ef4444]">{error}</p> : null}
    </div>
  );
}
