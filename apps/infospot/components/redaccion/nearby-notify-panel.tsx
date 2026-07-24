"use client";

import { useState, useTransition } from "react";
import {
  previewNearbyNotifyAction,
  sendNearbyNotifyAction,
  type NearbyNotifyActionResult,
} from "@/app/actions/nearby-notify";

type Props = {
  eventId: string;
  callOpen: boolean;
  canNotify: boolean;
  publicUrl: string | null;
};

type PreviewOk = Extract<NearbyNotifyActionResult, { kind: "preview" }>;

export function NearbyNotifyPanel({ eventId, callOpen, canNotify, publicUrl }: Props) {
  const [pending, startTransition] = useTransition();
  const [scopeMode, setScopeMode] = useState<"RADIUS_KM" | "CITY" | "PROVINCE">("RADIUS_KM");
  const [radiusKm, setRadiusKm] = useState(50);
  const [channelEmail, setChannelEmail] = useState(false);
  const [title, setTitle] = useState("Buscan fotógrafos cerca tuyo");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [sendResult, setSendResult] = useState<Extract<NearbyNotifyActionResult, { kind: "send" }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  if (!canNotify) {
    return (
      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-5 space-y-2">
        <h3 className="text-base font-semibold tracking-tight">Avisar a fotógrafos cercanos</h3>
        <p className="text-sm text-[var(--is-muted)]">
          No tenés permiso para enviar avisos. Podés crear o abrir la convocatoria, pero el envío
          requiere el permiso específico «Puede avisar a fotógrafos cercanos».
        </p>
      </section>
    );
  }

  if (!callOpen) {
    return (
      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-5 space-y-2">
        <h3 className="text-base font-semibold tracking-tight">Avisar a fotógrafos cercanos</h3>
        <p className="text-sm text-[var(--is-muted)]">
          Disponible solo cuando la convocatoria esté realmente abierta en CLF. Abrir la
          convocatoria no envía avisos automáticamente.
        </p>
      </section>
    );
  }

  function buildFormData(extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("scopeMode", scopeMode);
    fd.set("radiusKm", String(radiusKm));
    fd.set("channelInApp", "true");
    if (channelEmail) fd.set("channelEmail", "true");
    fd.set("notifyTitle", title);
    if (body.trim()) fd.set("notifyBody", body.trim());
    if (extra) {
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    }
    return fd;
  }

  const emailBlocked =
    Boolean(preview?.channels.includes("EMAIL")) && (preview?.byChannel.EMAIL ?? 0) === 0;
  const zeroEligible = (preview?.buckets.eligible ?? 0) === 0;
  const canConfirmSend =
    Boolean(preview?.callOpen) &&
    !zeroEligible &&
    !emailBlocked &&
    (preview?.eventHasCoords || scopeMode !== "RADIUS_KM");

  return (
    <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Avisar a fotógrafos cercanos</h3>
        <p className="mt-1 text-sm text-[var(--is-muted)]">
          Seleccioná el alcance, previsualizá la audiencia y confirmá el envío. Destino:{" "}
          {publicUrl ? (
            <a href={publicUrl} className="text-[var(--is-accent)] hover:underline" target="_blank" rel="noreferrer">
              convocatoria pública
            </a>
          ) : (
            "URL CLF"
          )}
          . Panel operativo:{" "}
          <a href="/admin/notificaciones" className="text-[var(--is-accent)] hover:underline">
            /admin/notificaciones
          </a>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Alcance</span>
          <select
            value={scopeMode}
            onChange={(e) =>
              setScopeMode(e.target.value as "RADIUS_KM" | "CITY" | "PROVINCE")
            }
            className="is-input mt-2"
          >
            <option value="RADIUS_KM">Radio (km)</option>
            <option value="CITY">Toda la ciudad</option>
            <option value="PROVINCE">Toda la provincia</option>
          </select>
        </label>
        {scopeMode === "RADIUS_KM" ? (
          <label className="block text-sm">
            <span className="font-medium">Radio</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="is-input mt-2"
            >
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
            </select>
          </label>
        ) : (
          <div />
        )}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={channelEmail}
          onChange={(e) => setChannelEmail(e.target.checked)}
          className="mt-1 size-4"
        />
        <span>
          Incluir canal EMAIL (solo destinatarios con opt-in explícito). IN_APP siempre se
          intenta para elegibles.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Título</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="is-input mt-2"
          maxLength={120}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Mensaje (opcional)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="is-input mt-2"
          maxLength={800}
          placeholder="Si lo dejás vacío se usa la plantilla estándar."
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-semibold disabled:opacity-60"
          onClick={() => {
            setError(null);
            setSendResult(null);
            startTransition(async () => {
              const result = await previewNearbyNotifyAction(eventId, buildFormData());
              if (!result.ok) {
                setPreview(null);
                setError(result.error);
                return;
              }
              if (result.kind === "preview") setPreview(result);
            });
          }}
        >
          {pending ? "Calculando…" : "Previsualizar audiencia"}
        </button>
      </div>

      {error ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-4 py-4">
          <p className="text-sm font-semibold">Vista previa</p>
          <p className="text-sm text-[var(--is-muted)]">
            {preview.city}
            {preview.province ? `, ${preview.province}` : ""} · alcance {preview.scopeLabel}
            {preview.eventHasCoords ? " · coords de evento OK" : " · sin coords de evento"}
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--is-text)]">
            {preview.summary}
          </pre>

          {preview.warnings.length ? (
            <ul className="space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {preview.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded border border-[var(--is-border)] bg-[var(--is-surface)] p-3">
              <p className="font-semibold mb-2">Por distancia</p>
              {Object.entries(preview.byDistanceKm).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded border border-[var(--is-border)] bg-[var(--is-surface)] p-3">
              <p className="font-semibold mb-2">Por ciudad</p>
              {Object.entries(preview.byCity).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded border border-[var(--is-border)] bg-[var(--is-surface)] p-3">
              <p className="font-semibold mb-2">Por canal</p>
              {Object.entries(preview.byChannel).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded border border-[var(--is-border)] bg-[var(--is-surface)] p-3 space-y-1">
              <p className="font-semibold">Preview IN_APP</p>
              <p className="font-medium">{preview.inAppPreview.title}</p>
              <p className="text-[var(--is-muted)] whitespace-pre-wrap">
                {preview.inAppPreview.body}
              </p>
              <p className="text-xs">CTA: {preview.inAppPreview.ctaLabel}</p>
            </div>
            <div className="rounded border border-[var(--is-border)] bg-[var(--is-surface)] p-3 space-y-1">
              <p className="font-semibold">Preview EMAIL</p>
              <p className="text-xs text-[var(--is-muted)]">Asunto: {preview.emailPreview.subject}</p>
              <p className="text-xs text-[var(--is-muted)] line-clamp-6">
                {preview.emailPreview.htmlSnippet.replace(/<[^>]+>/g, " ").slice(0, 280)}…
              </p>
            </div>
          </div>

          <pre className="whitespace-pre-wrap rounded border border-[var(--is-border)] bg-[var(--is-surface)] px-3 py-3 text-sm">
            {preview.confirmationText}
          </pre>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmSend}
              onChange={(e) => setConfirmSend(e.target.checked)}
              className="mt-1 size-4"
              disabled={!canConfirmSend}
            />
            <span>
              Confirmo el envío a {preview.buckets.eligible ?? "?"} fotógrafos elegibles. Esta
              acción crea una campaña y encola entregas.
            </span>
          </label>

          {!canConfirmSend ? (
            <p className="text-sm text-red-800">
              {zeroEligible
                ? "No se puede enviar a cero destinatarios."
                : emailBlocked
                  ? "EMAIL sin opt-ins: desmarcá EMAIL o ampliá la audiencia."
                  : !preview.eventHasCoords && scopeMode === "RADIUS_KM"
                    ? "Ubicación incompleta: no se puede usar radio sin coordenadas del evento."
                    : "La convocatoria no admite envío en este estado."}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending || !confirmSend || !canConfirmSend}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await sendNearbyNotifyAction(
                  eventId,
                  buildFormData({ confirmSend: "true" }),
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                if (result.kind === "send") {
                  setSendResult(result);
                  setConfirmSend(false);
                }
              });
            }}
          >
            {pending ? "Enviando…" : "Enviar notificación"}
          </button>
        </div>
      ) : null}

      {sendResult ? (
        <p className="rounded-[var(--is-radius-sm)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          Campaña {sendResult.campaignId}: encoladas y procesadas por worker — {sendResult.sent}{" "}
          enviadas
          {sendResult.failed ? `, ${sendResult.failed} fallidas` : ""}. Elegibles:{" "}
          {sendResult.eligibleCount}
          {"queued" in sendResult ? ` · Cola: ${sendResult.queued}` : ""}.{" "}
          <a
            href={`/admin/notificaciones/${sendResult.campaignId}`}
            className="font-semibold underline"
          >
            Ver en panel
          </a>
        </p>
      ) : null}
    </section>
  );
}
