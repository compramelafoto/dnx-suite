"use client";

import type { InputHTMLAttributes } from "react";
import { useResolvedTheme } from "@repo/design-system";
import { radius, fontSize } from "@repo/design-system";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className, style, onFocus, onBlur, ...props }: InputProps) {
  const theme = useResolvedTheme();

  return (
    <input
      className={cn("w-full min-w-[200px] transition-all duration-200 outline-none", className)}
      style={{
        borderRadius: radius.input,
        border: `1px solid ${theme.border.default}`,
        background: theme.surface.base,
        color: theme.text.primary,
        fontSize: fontSize.base,
        padding: "12px 16px",
        boxSizing: "border-box",
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.brand.primary}40`;
        e.currentTarget.style.borderColor = theme.brand.primary;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.borderColor = theme.border.default;
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
