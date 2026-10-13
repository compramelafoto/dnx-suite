"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, MessageCircle } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import {
  ESCOLAR_ASISTENCIA_MESSAGE_MAX,
  ESCOLAR_ASISTENCIA_PHONE_MAX,
  buildEscolarAsistenciaWhatsappUrl,
} from "@/lib/escolar/asistencia";
import { useEscolarPanelInfo, type EscolarPanelInfo } from "./useEscolarPanelInfo";

const SOPORTE_HREF = "/fotografo/soporte?tab=incidencias";

type Phase = "form" | "sending" | "done" | "already" | "error";

type Props = {
  label?: string;
  /** "solid": botón naranja; "outline": borde; "link": texto subrayado. */
  appearance?: "solid" | "outline" | "link";
  size?: "sm" | "md";
  className?: string;
  /** Sólo para la vista previa: datos sin pedirlos a la API. */
  previewInfo?: EscolarPanelInfo | null;
  /** Sólo para la vista previa: abre el panel de entrada. */
  defaultOpen?: boolean;
};

export default function EscolarAsistenciaButton({
  label = "Quiero asistencia para configurar mi módulo escolar",
  appearance = "outline",
  size = "sm",
  className,
  previewInfo,
  defaultOpen = false,
}: Props) {
  const infoState = useEscolarPanelInfo(previewInfo);
  const info = infoState.info;
  const [open, setOpen] = useState(defaultOpen);
  const [phase, setPhase] = useState<Phase>("form");
  const [phone, setPhone] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [requestedHere, setRequestedHere] = useState(false);

  if (infoState.status === "forbidden") return null;

  const phoneValue = phone ?? info?.phone ?? "";
  const whatsappHref = buildEscolarAsistenciaWhatsappUrl(info?.name);

  function openPanel() {
    // Si ya hay un pedido abierto, se avisa sin mostrar el formulario.
    setPhase(info?.openRequest || requestedHere ? "already" : "form");
    setErrorText(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (previewInfo) {
      setRequestedHere(true);
      setPhase("done");
      return;
    }
    setPhase("sending");
    setErrorText(null);
    try {
      const res = await fetch("/api/fotografo/escolar/asistencia", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, message }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; alreadyRequested?: boolean };
      if (!res.ok) {
        setErrorText(json.error || "No pudimos registrar el pedido. Probá de nuevo.");
        setPhase("error");
        return;
      }
      setRequestedHere(true);
      setPhase(json.alreadyRequested ? "already" : "done");
    } catch {
      setErrorText("No pudimos registrar el pedido. Revisá tu conexión y probá de nuevo.");
      setPhase("error");
    }
  }

  const trigger =
    appearance === "link" ? (
      <button
        type="button"
        onClick={openPanel}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-[#9a5c2a] underline-offset-2 hover:underline",
          className
        )}
      >
        <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
    ) : (
      <Button
        type="button"
        variant={appearance === "solid" ? "primary" : "secondary"}
        size={size}
        onClick={openPanel}
        className={cn("text-left", className)}
      >
        <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">{label}</span>
      </Button>
    );

  return (
    <>
      {trigger}
      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Asistencia para tu módulo escolar"
        contentClassName="ds-modal-scroll--padded"
      >
        {phase === "done" ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              ¡Listo! Recibimos tu pedido. Te vamos a contactar para ayudarte a configurarlo.
            </p>
            <Link href={SOPORTE_HREF} className="text-sm font-medium text-[#9a5c2a] hover:underline">
              Ver mis pedidos en Soporte →
            </Link>
          </div>
        ) : phase === "already" ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-[#c27b3d]/25 bg-[#fffaf5] p-4 text-sm text-[#4b3621]">
              Ya pediste asistencia; te vamos a contactar.
            </p>
            <Link href={SOPORTE_HREF} className="text-sm font-medium text-[#9a5c2a] hover:underline">
              Ver el pedido en Soporte →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm leading-relaxed text-[#4b5563]">
              Te ayudamos a dejar listo tu módulo escolar: instituciones, preventa, packs, selfie y tu landing para
              colegios.
            </p>
            <div>
              <label htmlFor="escolar-asistencia-phone" className="mb-1.5 block text-sm font-medium text-[#374151]">
                Teléfono / WhatsApp <span className="font-normal text-[#9ca3af]">(opcional)</span>
              </label>
              <Input
                id="escolar-asistencia-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={ESCOLAR_ASISTENCIA_PHONE_MAX}
                value={phoneValue}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 341 555-1234"
              />
            </div>
            <div>
              <label htmlFor="escolar-asistencia-msg" className="mb-1.5 block text-sm font-medium text-[#374151]">
                Mensaje <span className="font-normal text-[#9ca3af]">(opcional)</span>
              </label>
              <Textarea
                id="escolar-asistencia-msg"
                rows={3}
                maxLength={ESCOLAR_ASISTENCIA_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contanos con qué colegio querés empezar o qué te trabó."
              />
            </div>
            {phase === "error" && errorText ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                {errorText}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#047857] hover:underline"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                ¿Preferís WhatsApp?
              </a>
              <Button type="submit" variant="primary" disabled={phase === "sending"}>
                {phase === "sending" ? "Enviando…" : "Pedir asistencia"}
              </Button>
            </div>
          </form>
        )}
      </AppModal>
    </>
  );
}
