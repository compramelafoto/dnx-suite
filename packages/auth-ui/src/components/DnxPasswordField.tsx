"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { DNX_AUTH_CTA } from "../types";
import { controlStyle, errorTextStyle, fieldStack, helperStyle, labelStyle } from "../styles";

export type DnxPasswordFieldProps = {
  id?: string;
  label?: string;
  name?: string;
  error?: string | null;
  helperText?: string;
  disabled?: boolean;
  autoComplete?: "current-password" | "new-password" | "password";
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
};

/**
 * Campo de contraseña canónico con ojito a la derecha.
 * Una instancia independiente por campo (login / registro / reset).
 */
export function DnxPasswordField({
  id,
  label = "Contraseña",
  name = "password",
  error,
  helperText,
  disabled,
  autoComplete = "current-password",
  required = true,
  value,
  defaultValue,
  onChange,
}: DnxPasswordFieldProps) {
  const reactId = useId();
  const fieldId = id ?? `password-${reactId}`;
  const [visible, setVisible] = useState(false);

  const describedBy = [helperText ? `${fieldId}-helper` : null, error ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div data-dnx-auth-slot="password" style={fieldStack}>
      <label htmlFor={fieldId} style={labelStyle}>
        {label}
        {required ? (
          <span aria-hidden style={{ color: "var(--auth-primary)", marginLeft: 4 }}>
            *
          </span>
        ) : null}
      </label>
      <div style={{ position: "relative", width: "100%" }}>
        <input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={{
            ...controlStyle,
            paddingRight: "3.25rem",
            borderColor: error ? "var(--auth-error)" : (controlStyle.border as string),
          }}
        />
        <button
          type="button"
          tabIndex={0}
          disabled={disabled}
          aria-label={visible ? DNX_AUTH_CTA.hidePassword : DNX_AUTH_CTA.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          style={{
            position: "absolute",
            right: "0.35rem",
            top: "50%",
            transform: "translateY(-50%)",
            width: "2.75rem",
            height: "2.75rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: "var(--auth-text-secondary)",
            cursor: disabled ? "not-allowed" : "pointer",
            borderRadius: "var(--auth-radius)",
            padding: 0,
          }}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
      {helperText ? (
        <p id={`${fieldId}-helper`} style={helperStyle}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId}-error`} role="alert" style={errorTextStyle}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.5 10.5 0 0121 12c-.6 1.1-1.4 2.1-2.4 3M6.1 6.1C4.5 7.5 3.3 9.2 2.5 12c1.7 4.5 6 7.5 9.5 7.5 1.7 0 3.3-.5 4.7-1.3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12C4.2 7.5 8.5 4.5 12 4.5S19.8 7.5 21.5 12C19.8 16.5 15.5 19.5 12 19.5S4.2 16.5 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
