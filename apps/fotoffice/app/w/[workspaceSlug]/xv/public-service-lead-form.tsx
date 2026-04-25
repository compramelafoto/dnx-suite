"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createServiceLead } from "@/app/actions/service-lead";

type XvFormConfig = {
  postSubmitAction?: {
    type?: "NONE" | "WHATSAPP" | "URL";
    delaySeconds?: number;
    url?: string;
  };
};

function toConfig(input: unknown): XvFormConfig {
  if (!input || typeof input !== "object") return {};
  return input as XvFormConfig;
}

function getPostSubmitAction(config: XvFormConfig): { type: "NONE" | "WHATSAPP" | "URL"; delaySeconds: number; url: string } {
  const raw = config.postSubmitAction;
  const type = raw?.type === "URL" || raw?.type === "WHATSAPP" ? raw.type : "NONE";
  const delaySeconds =
    typeof raw?.delaySeconds === "number" && Number.isFinite(raw.delaySeconds) && raw.delaySeconds >= 0
      ? raw.delaySeconds
      : 3;
  const url = typeof raw?.url === "string" ? raw.url.trim() : "";
  return { type, delaySeconds, url };
}

export function PublicServiceLeadForm({
  workspaceSlug,
  formId,
  formSlug,
  configJson,
}: {
  workspaceSlug: string;
  formId?: string;
  formSlug?: string;
  configJson?: unknown;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const config = useMemo(() => toConfig(configJson), [configJson]);
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
          Recibimos tus datos y te vamos a contactar pronto con una propuesta para tu cobertura de XV.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);

        const payload = {
          workspaceSlug,
          formId,
          formSlug,
          name: formData.get("name")?.toString() ?? "",
          email: formData.get("email")?.toString() ?? "",
          phone: formData.get("phone")?.toString() ?? "",
          eventType: "XV",
          eventDate: formData.get("eventDate")?.toString() ?? "",
          eventLocation: formData.get("eventLocation")?.toString() ?? "",
          message: formData.get("message")?.toString() ?? "",
        };

        startTransition(async () => {
          const result = await createServiceLead(payload);
          if (result.success) {
            setOk(true);
            formRef.current?.reset();
            return;
          }
          setError(result.error);
        });
      }}
    >
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-name">
          Nombre
        </label>
        <input id="xv-name" name="name" required className="fo-input" placeholder="Tu nombre y apellido" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-email">
          Email
        </label>
        <input id="xv-email" name="email" type="email" className="fo-input" placeholder="tu@email.com" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-phone">
          WhatsApp
        </label>
        <input id="xv-phone" name="phone" className="fo-input" placeholder="+54 9 11 ..." />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-date">
          Fecha del evento
        </label>
        <input id="xv-date" name="eventDate" type="date" className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-location">
          Lugar
        </label>
        <input id="xv-location" name="eventLocation" className="fo-input" placeholder="Ciudad / salón" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-message">
          Contanos qué estás buscando
        </label>
        <textarea
          id="xv-message"
          name="message"
          rows={4}
          className="fo-input"
          placeholder="Cantidad de horas, estilo, si querés video, etc."
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar consulta"}
      </button>
    </form>
  );
}
