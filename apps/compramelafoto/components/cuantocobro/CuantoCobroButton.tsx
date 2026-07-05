"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type CuantoCobroButtonVariant = "primary" | "secondary" | "outline";

export type CuantoCobroButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CuantoCobroButtonVariant;
  /** Permite texto en varias líneas en CTAs largos (móvil). */
  multiline?: boolean;
};

const CuantoCobroButton = forwardRef<HTMLButtonElement, CuantoCobroButtonProps>(
  function CuantoCobroButton(
    { variant = "primary", multiline = false, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "cc-btn-link",
          variant === "primary" && "cc-btn-link--primary",
          variant === "secondary" && "cc-btn-link--secondary",
          variant === "outline" && "cc-btn-link--outline",
          multiline && "cc-btn-link--wrap",
          className,
        )}
        {...props}
      />
    );
  },
);

export default CuantoCobroButton;
