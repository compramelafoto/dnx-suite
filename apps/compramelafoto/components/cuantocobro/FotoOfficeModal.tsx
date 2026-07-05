"use client";

import AppModal from "@/components/ui/AppModal";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import {
  CC_FOTOOFFICE_INTEREST_CTA_HINT,
  CC_FOTOOFFICE_INTEREST_SUCCESS_MESSAGE,
  CC_FOTOOFFICE_RESULT_CTA_PRIMARY,
  type FotoOfficeInterestMetadataInput,
} from "@/lib/cuantocobro/fotooffice-interest";
import { useEffect, useMemo, useState } from "react";

type SessionUser = {
  id: number;
  email: string;
  name: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  metadata: FotoOfficeInterestMetadataInput;
  availableEmail?: string | null;
  availableName?: string | null;
};

const FOTOOFFICE_FEATURES = [
  {
    title: "Gestión comercial",
    items: [
      "Gestionar clientes",
      "Registrar consultas comerciales",
      "Crear oportunidades de venta",
      "Enviar presupuestos",
      "Convertir presupuestos aceptados en pedidos",
      "Organizar trabajos confirmados",
      "Crear flujos de trabajo por producto o servicio vendido",
      "Gestionar tareas, fechas y responsables",
    ],
  },
  {
    title: "Integraciones y finanzas",
    items: [
      "Integrarse con Google Calendar",
      "Controlar cuentas por cobrar",
      "Registrar cuentas por pagar",
    ],
  },
  {
    title: "Análisis y precios",
    items: [
      "Analizar ventas reales",
      "Medir tasa de conversión",
      "Comparar objetivos comerciales con resultados reales",
      "Detectar temporadas fuertes y meses flojos",
      "Recibir recomendaciones para ajustar precios",
      "Conectar con ¿Cuánto Cobro? para mejorar el precio recomendado usando datos reales del negocio",
    ],
  },
] as const;

export default function FotoOfficeModal({
  open,
  onClose,
  metadata,
  availableEmail = null,
  availableName = null,
}: Props) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data: { user?: SessionUser | null }) => {
        if (!cancelled) setSessionUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setSessionUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmailInput("");
      setEmailError(null);
      setSubmitError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [open]);

  const resolvedEmail = useMemo(() => {
    if (sessionUser?.email) return sessionUser.email;
    if (availableEmail?.trim()) return availableEmail.trim();
    return emailInput.trim();
  }, [availableEmail, emailInput, sessionUser?.email]);

  const needsEmailInput = !sessionUser?.email && !availableEmail?.trim();

  async function handleSubmit() {
    setSubmitError(null);
    setEmailError(null);

    if (needsEmailInput) {
      const validationError = getCheckoutEmailValidationError(emailInput);
      if (validationError) {
        setEmailError(validationError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cuantocobro/fotooffice-interest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(needsEmailInput ? { email: emailInput.trim() } : {}),
          name: sessionUser?.name ?? availableName ?? null,
          metadata,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "No pudimos registrar tu interés.");
      }

      setSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos registrar tu interés.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}

      maxWidthCapRem="42rem"
      title="¿Qué es FotoOffice?"
      description={
        <span className="text-sm leading-relaxed text-[var(--cc-color-muted)]">
          FotoOffice es la futura herramienta de gestión integral para fotógrafos de ComprameLaFoto. Está en
          desarrollo y tenemos previsto lanzarla en septiembre de 2026.
        </span>
      }
      panelClassName="cc-fotooffice-modal cc-page"
      contentClassName="ds-modal-scroll--padded"
      zIndexClass="z-[90]"
    >
      <div className="cc-fotooffice-modal__body ds-stack-section">
        {FOTOOFFICE_FEATURES.map((group) => (
          <section key={group.title} className="cc-fotooffice-modal__group">
            <h4 className="cc-fotooffice-modal__group-title m-0">{group.title}</h4>
            <ul className="cc-fotooffice-modal__list m-0 pl-5">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <div className="cc-fotooffice-modal__highlight" role="note">
          <p className="m-0 text-sm leading-relaxed">
            Con <strong>¿Cuánto Cobro?</strong> estimás el precio correcto. Con <strong>FotoOffice</strong> vas a
            poder comprobar, medir y mejorar esos precios usando la actividad real de tu empresa.
          </p>
        </div>

        {success ? (
          <div className="ds-info-panel cc-info-panel--accent" role="status">
            <p className="ds-info-panel__body m-0 text-sm">{CC_FOTOOFFICE_INTEREST_SUCCESS_MESSAGE}</p>
          </div>
        ) : (
          <div className="cc-fotooffice-modal__cta ds-stack-section">
            {needsEmailInput ? (
              <DsField
                label="Dejanos tu email para avisarte"
                htmlFor="cc-fotooffice-email"
                error={emailError ?? undefined}
              >
                <Input
                  id="cc-fotooffice-email"
                  type="email"
                  autoComplete="email"
                  className="min-h-[44px]"
                  placeholder="tu@email.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                />
              </DsField>
            ) : (
              <p className="cc-fotooffice-modal__email-hint m-0 text-sm text-[var(--cc-color-muted)]">
                Te vamos a contactar a <strong>{resolvedEmail}</strong>.
              </p>
            )}

            <CuantoCobroButton
              type="button"
              variant="primary"
              multiline
              className="w-full min-h-[44px] sm:w-auto"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Registrando…" : CC_FOTOOFFICE_RESULT_CTA_PRIMARY}
            </CuantoCobroButton>

            <p className="cc-fotooffice-modal__cta-hint m-0 text-sm text-[var(--cc-color-muted)]">
              {CC_FOTOOFFICE_INTEREST_CTA_HINT}
            </p>

            {submitError ? (
              <div className="ds-info-panel cc-info-panel--warning" role="alert">
                <p className="ds-info-panel__body m-0 text-sm">{submitError}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppModal>
  );
}
