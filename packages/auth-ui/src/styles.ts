import type { CSSProperties } from "react";

export const fieldStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  width: "100%",
};

export const labelStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "var(--auth-text-primary)",
  fontFamily: "var(--auth-font)",
};

export const controlStyle: CSSProperties = {
  width: "100%",
  minHeight: "var(--auth-control-height)",
  padding: "0.75rem 1rem",
  borderRadius: "var(--auth-radius)",
  border: "1px solid var(--auth-border)",
  background: "var(--auth-surface)",
  color: "var(--auth-text-primary)",
  fontSize: "1rem",
  fontFamily: "var(--auth-font)",
  boxSizing: "border-box",
};

export const helperStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--auth-text-secondary)",
  lineHeight: 1.5,
};

export const errorTextStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--auth-error)",
  lineHeight: 1.5,
};

export const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "var(--auth-control-height)",
  padding: "0.75rem 1.25rem",
  borderRadius: "var(--auth-radius)",
  border: "none",
  background: "var(--auth-primary)",
  color: "var(--auth-primary-text)",
  fontWeight: 600,
  fontSize: "1rem",
  fontFamily: "var(--auth-font)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  textDecoration: "none",
  boxSizing: "border-box",
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "transparent",
  color: "var(--auth-text-primary)",
  border: "1px solid var(--auth-secondary-border, var(--auth-border))",
};
