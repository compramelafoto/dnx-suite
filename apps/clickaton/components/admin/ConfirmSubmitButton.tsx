"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  confirmMessage: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
};

/**
 * Botón submit con confirmación específica (acciones sensibles de cronograma/consignas).
 * No altera la action del form; solo intercepta el submit.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
}: Props) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}
