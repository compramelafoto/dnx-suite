"use client";

import type { InputHTMLAttributes } from "react";
import { controlStyle, errorTextStyle, fieldStack, helperStyle, labelStyle } from "../styles";

export type DnxEmailFieldProps = {
  id?: string;
  label?: string;
  error?: string | null;
  helperText?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  autoComplete?: string;
  required?: boolean;
};

export function DnxEmailField({
  id = "email",
  label = "Email",
  error,
  helperText,
  disabled,
  name = "email",
  value,
  defaultValue,
  onChange,
  autoComplete = "username",
  required = true,
}: DnxEmailFieldProps) {
  const describedBy = [helperText ? `${id}-helper` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div data-dnx-auth-slot="email" style={fieldStack}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required ? (
          <span aria-hidden style={{ color: "var(--auth-primary)", marginLeft: 4 }}>
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type="email"
        inputMode="email"
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
          borderColor: error ? "var(--auth-error)" : controlStyle.border as string,
        }}
      />
      {helperText ? (
        <p id={`${id}-helper`} style={helperStyle}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" style={errorTextStyle}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
