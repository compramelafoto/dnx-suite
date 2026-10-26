"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createServiceLead } from "@/app/actions/service-lead";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import { CAMPO_TRAMPA } from "@/lib/consultas/trampa";
import { useHidratado } from "@/lib/ui/use-hidratado";

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

/** Lo que cambia entre el formulario de XV y el de boda: el tipo y algunos textos. */
const TEXTOS = {
  XV: {
    gracias: "Recibimos tus datos y te vamos a contactar pronto con una propuesta para tu cobertura de XV.",
    lugar: "Ciudad / salón",
    mensaje: "Cantidad de horas, estilo, si querés video, etc.",
  },
  BODA: {
    gracias: "Recibimos sus datos y les vamos a mandar pronto la propuesta para su boda.",
    lugar: "Ciudad / lugar de la ceremonia y de la fiesta",
    mensaje: "Horarios, si hay civil e iglesia, si quieren sesión pre boda o video, etc.",
  },
} as const;

export function PublicServiceLeadForm({
  workspaceSlug,
  formId,
  formSlug,
  eventType = "XV",
  configJson,
  insertado = false,
}: {
  workspaceSlug: string;
  formId?: string;
  formSlug?: string;
  /** El tipo de la consulta: define la categoría (y con ella la propuesta modelo). */
  eventType?: keyof typeof TEXTOS;
  configJson?: unknown;
  /** Dibujado dentro de otra web (`/w/<slug>/insertar/xv`): no salta de página al terminar. */
  insertado?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const hidratado = useHidratado();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const config = useMemo(() => toConfig(configJson), [configJson]);
  const postSubmitAction = useMemo(() => getPostSubmitAction(config), [config]);

  useEffect(() => {
    if (!ok) return;
    // Insertado en otra web, saltar de página dentro del marco no sirve (WhatsApp no se deja
    // enmarcar) y sacar a la persona de la web que la contiene tampoco: se ofrece un botón.
    if (insertado) return;
    if (postSubmitAction.type === "NONE") return;
    if (!postSubmitAction.url) return;

    const timeout = window.setTimeout(() => {
      window.location.href = postSubmitAction.url;
    }, postSubmitAction.delaySeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [ok, postSubmitAction, insertado]);

  if (ok) {
    return (
      <div className="fo-alert-success rounded-[var(--fo-radius-sm)] p-6 text-center">
        <p className="text-[var(--fo-text)] font-medium">¡Gracias por tu consulta!</p>
        <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
          {TEXTOS[eventType].gracias}
        </p>
        {insertado && postSubmitAction.type !== "NONE" && postSubmitAction.url ? (
          <a
            href={postSubmitAction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="fo-btn fo-btn-primary mt-4 inline-flex"
          >
            {postSubmitAction.type === "WHATSAPP" ? "Seguir por WhatsApp" : "Continuar"}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    // POST: si se envía antes de que cargue la página, los datos no quedan en la dirección.
    <form
      ref={formRef}
      method="post"
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
          eventType,
          eventDate: formData.get("eventDate")?.toString() ?? "",
          eventLocation: formData.get("eventLocation")?.toString() ?? "",
          message: formData.get("message")?.toString() ?? "",
          [CAMPO_TRAMPA]: formData.get(CAMPO_TRAMPA)?.toString() ?? "",
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
      <CampoTrampa />
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
        <input id="xv-date" name="eventDate" type="date" required className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="xv-location">
          Lugar
        </label>
        <input id="xv-location" name="eventLocation" required className="fo-input" placeholder={TEXTOS[eventType].lugar} />
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
          placeholder={TEXTOS[eventType].mensaje}
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={pending || !hidratado}>
        {pending ? "Enviando..." : hidratado ? "Enviar consulta" : "Cargando..."}
      </button>
    </form>
  );
}
