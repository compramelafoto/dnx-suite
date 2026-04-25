"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createServiceLead } from "@/app/actions/service-lead";

type SelectorOption = { value: string; label: string };
type FieldDefinition = {
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "textarea" | "select" | "number";
  required?: boolean;
  options?: SelectorOption[];
};
type FormDefinition = {
  eventType: string;
  label: string;
  fields: FieldDefinition[];
};
type GeneralFormConfig = {
  schemaVersion?: number;
  submitLabel?: string;
  successMessage?: string;
  entrySelector?: {
    name?: string;
    label?: string;
    required?: boolean;
    options?: SelectorOption[];
  };
  forms?: Record<string, FormDefinition>;
  postSubmitAction?: {
    type?: "NONE" | "WHATSAPP" | "URL";
    delaySeconds?: number;
    url?: string;
  };
};

type FormPayload = {
  id: string;
  slug: string;
  configJson: unknown;
};

function toConfig(input: unknown): GeneralFormConfig {
  if (!input || typeof input !== "object") return {};
  return input as GeneralFormConfig;
}

function getPostSubmitAction(config: GeneralFormConfig): { type: "NONE" | "WHATSAPP" | "URL"; delaySeconds: number; url: string } {
  const raw = config.postSubmitAction;
  const type = raw?.type === "URL" || raw?.type === "WHATSAPP" ? raw.type : "NONE";
  const delaySeconds =
    typeof raw?.delaySeconds === "number" && Number.isFinite(raw.delaySeconds) && raw.delaySeconds >= 0
      ? raw.delaySeconds
      : 3;
  const url = typeof raw?.url === "string" ? raw.url.trim() : "";
  return { type, delaySeconds, url };
}

function renderFieldInput(field: FieldDefinition) {
  const required = field.required === true;
  const common = {
    id: `general-${field.name}`,
    name: field.name,
    required,
    className: "fo-input",
  };

  if (field.type === "textarea") {
    return <textarea {...common} rows={4} />;
  }
  if (field.type === "select") {
    return (
      <select {...common} defaultValue="">
        <option value="">Seleccionar</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  const htmlType =
    field.type === "phone"
      ? "tel"
      : field.type === "number"
        ? "number"
        : field.type === "date"
          ? "date"
          : field.type === "email"
            ? "email"
            : "text";
  return <input {...common} type={htmlType} />;
}

export function PublicDynamicServiceLeadForm({
  workspaceSlug,
  form,
}: {
  workspaceSlug: string;
  form: FormPayload;
}) {
  const config = useMemo(() => toConfig(form.configJson), [form.configJson]);
  const selector = config.entrySelector;
  const [selectedValue, setSelectedValue] = useState("");
  const selectedForm = selectedValue ? config.forms?.[selectedValue] : undefined;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const postSubmitAction = useMemo(() => getPostSubmitAction(config), [config]);

  useEffect(() => {
    if (!ok) return;
    if (postSubmitAction.type === "NONE") return;
    if (!postSubmitAction.url) return;

    const timeout = window.setTimeout(() => {
      window.location.href = postSubmitAction.url;
    }, postSubmitAction.delaySeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [ok, postSubmitAction]);

  if (ok) {
    return (
      <div className="fo-alert-success rounded-[var(--fo-radius-sm)] p-6 text-center">
        <p className="text-[var(--fo-text)] font-medium">¡Gracias por tu consulta!</p>
        <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
          {config.successMessage ??
            "¡Gracias por tu consulta! Recibimos tus datos y te vamos a contactar pronto."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (!selectedForm) {
          setError("Seleccioná primero el tipo de presupuesto.");
          return;
        }

        const formData = new FormData(e.currentTarget);
        const meta: Record<string, unknown> = {};
        for (const field of selectedForm.fields) {
          const value = formData.get(field.name)?.toString() ?? "";
          meta[field.name] = value.trim();
        }

        if (selector?.name) {
          meta[selector.name] = selectedValue;
        } else {
          meta.budgetType = selectedValue;
        }

        const payload = {
          workspaceSlug,
          formId: form.id,
          formSlug: "general",
          eventType: selectedForm.eventType,
          name: formData.get("name")?.toString() ?? "",
          email: formData.get("email")?.toString() ?? "",
          phone: formData.get("phone")?.toString() ?? "",
          meta,
        };

        startTransition(async () => {
          const result = await createServiceLead(payload);
          if (result.success) {
            setOk(true);
            return;
          }
          setError(result.error);
        });
      }}
    >
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="general-budget-type">
          {selector?.label ?? "Solicitud de presupuesto para"}
        </label>
        <select
          id="general-budget-type"
          className="fo-input"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          required={selector?.required !== false}
        >
          <option value="">Seleccionar</option>
          {(selector?.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="general-name">
          Nombre
        </label>
        <input id="general-name" name="name" required className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="general-email">
          Email
        </label>
        <input id="general-email" name="email" type="email" className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="general-phone">
          WhatsApp
        </label>
        <input id="general-phone" name="phone" type="tel" className="fo-input" />
      </div>

      {selectedForm ? (
        <div className="space-y-4">
          {selectedForm.fields.map((field) => (
            <div className="fo-field-stack" key={field.name}>
              <label className="fo-label" htmlFor={`general-${field.name}`}>
                {field.label}
              </label>
              {renderFieldInput(field)}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={pending}>
        {pending ? "Enviando..." : config.submitLabel ?? "Enviar consulta"}
      </button>
    </form>
  );
}
