"use client";

import { useMemo, useState } from "react";
import {
  PartnerWelcomeInterstitial,
  type PartnerWelcomeFrequencyStore,
  type PartnerWelcomeResponsiveMediaInput,
} from "@repo/design-system/components/partners";
import type {
  WelcomeGraphicEffectiveRow,
  WelcomeGraphicProfileSlotView,
  WelcomeResponsiveMediaSnapshot,
} from "@repo/partners";
import {
  DEFAULT_WELCOME_GRAPHIC_LIMITS,
  WELCOME_GRAPHIC_CTA_COPY,
  WELCOME_GRAPHIC_SAFE_AREA_COPY,
  WELCOME_PROFILE_SECTION_DESCRIPTION,
  WELCOME_PROFILE_SECTION_TITLE,
} from "@repo/partners/client-safe";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  approveWelcomeGraphicFromProfileFormAction,
  archiveWelcomeGraphicFromProfileFormAction,
  setWelcomeGraphicDefaultFromProfileFormAction,
  uploadWelcomeGraphicFromProfileFormAction,
} from "@/lib/admin/partners/welcome-graphic-profile-mutations";

export type WelcomeGraphicsProfileSectionProps = {
  partnerId: string;
  partnerName: string;
  slots: WelcomeGraphicProfileSlotView[];
  effective: WelcomeGraphicEffectiveRow[];
  snapshot: WelcomeResponsiveMediaSnapshot;
  warningMessages: string[];
};

function SlotCard({
  partnerId,
  slot,
}: {
  partnerId: string;
  slot: WelcomeGraphicProfileSlotView;
}) {
  const current = slot.current;
  const mime = (current?.mimeType ?? "").toLowerCase();
  const isGif = mime.includes("gif");
  const showThumb = current?.fileUrl && !isGif && slot.status !== "ARCHIVED";

  return (
    <Card variant="outlined" className="space-y-4 p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-ck-text">{slot.title}</h3>
          <Badge>{slot.statusLabel}</Badge>
          {parseWelcomeDefault(current) ? <Badge>Predeterminada</Badge> : null}
        </div>
        <p className="text-sm text-ck-text-secondary">{slot.description}</p>
        <p className="text-xs text-ck-text-secondary">
          {slot.recommendation} · Sugerido {slot.suggestedSize}
        </p>
        {slot.isGifWithoutStaticFallback ? (
          <p className="text-xs text-amber-200">
            GIF sin fallback estático: en movimiento reducido se usará el logo (si hay) o se
            bloqueará la publicación.
          </p>
        ) : null}
      </div>

      {showThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current!.fileUrl!}
          alt={current!.altText || slot.title}
          className="mx-auto max-h-36 object-contain"
          loading="lazy"
        />
      ) : isGif && current?.fileUrl ? (
        <p className="rounded-lg border border-dashed border-ck-border px-3 py-6 text-center text-sm text-ck-text-secondary">
          GIF · no se descarga en la ficha. Abrí la preview para verlo.
        </p>
      ) : (
        <p className="text-sm text-ck-text-muted">Sin pieza activa en este slot.</p>
      )}

      {current ? (
        <p className="text-xs text-ck-text-secondary">
          {current.mimeType || "mime?"} ·{" "}
          {current.width && current.height ? `${current.width}×${current.height}` : "dims?"} ·{" "}
          {typeof current.fileSize === "number"
            ? `${Math.round(current.fileSize / 1024)} KB`
            : "peso?"}{" "}
          · alt: {current.altText || "—"} · id {current.id.slice(0, 8)}
        </p>
      ) : null}

      <form
        action={uploadWelcomeGraphicFromProfileFormAction}
        encType="multipart/form-data"
        className="space-y-3 border-t border-ck-border pt-4"
      >
        <input type="hidden" name="partnerId" value={partnerId} />
        <input type="hidden" name="welcomeSlot" value={slot.slotKey} />
        <Field id={`file-${slot.slotKey}`} label={current ? "Reemplazar archivo" : "Subir archivo"}>
          <input
            type="file"
            name="file"
            accept="image/png,image/webp,image/jpeg,image/jpg,image/gif"
            required
            className="block w-full text-sm text-ck-text-secondary"
          />
        </Field>
        <Field id={`alt-${slot.slotKey}`} label="Texto alternativo" required>
          <Input
            name="altText"
            required
            defaultValue={current?.altText ?? ""}
            placeholder="Descripción accesible de la pieza"
          />
        </Field>
        <Button type="submit" variant="secondary">
          {current ? "Reemplazar (queda pendiente)" : "Cargar (queda pendiente)"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {current && current.approvalStatus === "PENDING" && !current.archivedAt ? (
          <form action={approveWelcomeGraphicFromProfileFormAction}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input type="hidden" name="assetId" value={current.id} />
            <Button type="submit">Aprobar</Button>
          </form>
        ) : null}
        {current &&
        current.approvalStatus === "APPROVED" &&
        !current.archivedAt &&
        !parseWelcomeDefault(current) ? (
          <form action={setWelcomeGraphicDefaultFromProfileFormAction}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input type="hidden" name="assetId" value={current.id} />
            <Button type="submit" variant="secondary">
              Marcar predeterminada
            </Button>
          </form>
        ) : null}
        {current && !current.archivedAt ? (
          <form action={archiveWelcomeGraphicFromProfileFormAction}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input type="hidden" name="assetId" value={current.id} />
            <Button type="submit" variant="secondary">
              Archivar
            </Button>
          </form>
        ) : null}
      </div>

      {slot.history.length > 1 ? (
        <details className="text-xs text-ck-text-secondary">
          <summary className="cursor-pointer font-medium text-ck-text">Historial del slot</summary>
          <ul className="mt-2 space-y-1">
            {slot.history.map((h) => (
              <li key={h.id}>
                {h.approvalStatus}
                {h.archivedAt ? " · archivada" : ""} · {h.id.slice(0, 8)} ·{" "}
                {h.altText || "sin alt"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function parseWelcomeDefault(asset: WelcomeGraphicProfileSlotView["current"]): boolean {
  if (!asset?.metadata || typeof asset.metadata !== "object") return false;
  const root = asset.metadata as Record<string, unknown>;
  const wg = (root.welcomeGraphic ?? root) as Record<string, unknown>;
  return Boolean(wg?.isDefault);
}

/**
 * Sección de biblioteca welcome en la ficha del sponsor.
 */
export function WelcomeGraphicsProfileSection({
  partnerId,
  partnerName,
  slots,
  effective,
  snapshot,
  warningMessages,
}: WelcomeGraphicsProfileSectionProps) {
  const [openPreview, setOpenPreview] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [simulateError, setSimulateError] = useState<"none" | "desktop" | "mobile" | "both">(
    "none",
  );

  const memoryStore = useMemo<PartnerWelcomeFrequencyStore>(
    () => ({
      getItem: () => null,
      setItem: () => undefined,
    }),
    [],
  );

  const media = snapshot as PartnerWelcomeResponsiveMediaInput;

  return (
    <section className="space-y-6" data-welcome-graphics-profile="1">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-ck-text">{WELCOME_PROFILE_SECTION_TITLE}</h2>
        <p className="text-sm text-ck-text-secondary">{WELCOME_PROFILE_SECTION_DESCRIPTION}</p>
        <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_SAFE_AREA_COPY}</p>
        <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_CTA_COPY}</p>
        <p className="text-xs text-ck-text-secondary">
          Límites: desktop estático{" "}
          {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopStaticMaxBytes / 1024)} KB · mobile
          estático {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileStaticMaxBytes / 1024)} KB ·
          desktop GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopGifMaxBytes / 1024)} KB ·
          mobile GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileGifMaxBytes / 1024)} KB.
          Biblioteca reutilizable entre campañas autorizadas (no publica sola).
        </p>
      </div>

      {warningMessages.length ? (
        <Card variant="outlined" className="space-y-2 border-amber-500/30 p-4 text-sm text-amber-100">
          {warningMessages.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-ck-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ck-border text-xs uppercase tracking-wide text-ck-text-secondary">
            <tr>
              <th className="px-3 py-2">Dispositivo</th>
              <th className="px-3 py-2">Pieza principal</th>
              <th className="px-3 py-2">Movimiento reducido</th>
              <th className="px-3 py-2">Fallback final</th>
            </tr>
          </thead>
          <tbody>
            {effective.map((row) => (
              <tr key={row.device} className="border-b border-ck-border/60">
                <td className="px-3 py-2 text-ck-text">{row.deviceLabel}</td>
                <td className="px-3 py-2 text-ck-text-secondary">{row.primaryLabel}</td>
                <td className="px-3 py-2 text-ck-text-secondary">{row.reducedMotionLabel}</td>
                <td className="px-3 py-2 text-ck-text-secondary">{row.finalFallbackLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {slots.map((slot) => (
          <SlotCard key={slot.slotKey} partnerId={partnerId} slot={slot} />
        ))}
      </div>

      <Card variant="outlined" className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
            Preview · tracking OFF · impresión 0 · frecuencia 0
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-ck-border bg-ck-surface px-2 py-1 text-sm"
              value={viewport}
              onChange={(e) => setViewport(e.target.value as "desktop" | "mobile")}
              aria-label="Viewport preview perfil"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile 390×844</option>
            </select>
            <select
              className="rounded-md border border-ck-border bg-ck-surface px-2 py-1 text-sm"
              value={simulateError}
              onChange={(e) =>
                setSimulateError(e.target.value as "none" | "desktop" | "mobile" | "both")
              }
              aria-label="Simular error"
            >
              <option value="none">Sin error</option>
              <option value="desktop">Error desktop</option>
              <option value="mobile">Error mobile</option>
              <option value="both">Error ambos</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-ck-text-secondary">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
              Movimiento reducido
            </label>
            <Button type="button" onClick={() => setOpenPreview(true)}>
              Abrir preview
            </Button>
          </div>
        </div>
        {openPreview ? (
          <PartnerWelcomeInterstitial
            key={`${partnerId}-${viewport}-${reducedMotion}-${simulateError}`}
            campaignId={`profile-preview-${partnerId}`}
            partnerName={partnerName}
            media={media}
            imageUrl={snapshot.imageUrl}
            href={null}
            title="Preview de gráfica"
            body="Vista previa desde el perfil del sponsor."
            ctaText="Conocer más"
            creativeId="profile-preview-creative"
            placementKey="PROFILE_WELCOME_PREVIEW"
            appearDelayMs={0}
            animationVariant="fade"
            disableFrequencyCap
            frequencyStore={memoryStore}
            trackingEnabled={false}
            previewViewport={viewport}
            previewReducedMotion={reducedMotion}
            previewSimulateError={simulateError === "none" ? null : simulateError}
            sponsoredLabel="Vista previa · Contenido patrocinado"
            onDismiss={() => setOpenPreview(false)}
          />
        ) : null}
      </Card>
    </section>
  );
}
