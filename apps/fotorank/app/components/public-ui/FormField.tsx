import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Base = {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type InputProps = Base & {
  as?: "input";
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

type SelectProps = Base & {
  as: "select";
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children">;

type TextareaProps = Base & {
  as: "textarea";
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export type FormFieldProps = InputProps | SelectProps | TextareaProps;

const FIELD_META_KEYS = new Set(["as", "id", "label", "helper", "error", "className", "required", "children"]);

function omitFieldMeta(props: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!FIELD_META_KEYS.has(key)) rest[key] = value;
  }
  return rest;
}

export function FormField(props: FormFieldProps) {
  const { id, label, helper, error, required, className } = props;
  const describedBy =
    [helper ? `${id}-helper` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  const controlProps = omitFieldMeta(props as unknown as Record<string, unknown>);

  let control: ReactNode;
  if (props.as === "select") {
    control = (
      <select
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        {...controlProps}
      >
        {props.children}
      </select>
    );
  } else if (props.as === "textarea") {
    control = (
      <textarea
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        {...controlProps}
      />
    );
  } else {
    control = (
      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        {...controlProps}
      />
    );
  }

  return (
    <div className={cn("fr-public-field", className)}>
      <label htmlFor={id} className="fr-public-field__label">
        {label}
        {required ? <span className="text-[var(--primary)]"> *</span> : null}
      </label>
      {control}
      {helper ? (
        <p id={`${id}-helper`} className="fr-public-field__helper">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="fr-public-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
