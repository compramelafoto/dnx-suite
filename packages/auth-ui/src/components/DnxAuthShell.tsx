import type { ReactNode } from "react";
import type { DnxAuthBrandConfig } from "../types";

export function DnxAuthShell({
  brand,
  children,
  footer,
}: {
  brand: DnxAuthBrandConfig;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className={`dnx-auth-root ${brand.tokens.className ?? ""}`}
      data-brand={brand.tokens.brandKey}
      data-application={brand.applicationId}
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "var(--auth-background)",
        color: "var(--auth-text-primary)",
        fontFamily: brand.tokens.fontFamily ?? "var(--auth-font)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "var(--auth-content-width)",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        <div
          style={{
            width: "100%",
            background: "var(--auth-surface)",
            border: "1px solid var(--auth-border)",
            borderRadius: "calc(var(--auth-radius) + 0.25rem)",
            padding: "2rem",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "2rem",
          }}
        >
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
