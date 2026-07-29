"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { primaryButtonStyle } from "../styles";

export type DnxPrimaryAuthButtonProps = {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  form?: string;
};

export function DnxPrimaryAuthButton({
  children,
  loading,
  loadingLabel = "Procesando…",
  disabled,
  type = "submit",
  onClick,
  form,
}: DnxPrimaryAuthButtonProps) {
  const busy = Boolean(loading);
  return (
    <button
      data-dnx-auth-slot="primary-cta"
      type={type}
      form={form}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      style={{
        ...primaryButtonStyle,
        position: "relative",
        opacity: disabled || busy ? 0.7 : 1,
        cursor: disabled || busy ? "not-allowed" : "pointer",
        minWidth: "100%",
      }}
    >
      <span style={{ visibility: busy ? "hidden" : "visible" }}>{children}</span>
      {busy ? (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          {loadingLabel}
        </span>
      ) : null}
    </button>
  );
}
