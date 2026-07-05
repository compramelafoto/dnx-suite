"use client";

import PhotoStarRating from "@/components/simulator/PhotoStarRating";
import CaptureMetadataPanel from "@/components/simulator/gallery/CaptureMetadataPanel";
import Button from "@/components/ui/Button";
import { verdictLabel } from "@/lib/simulator/camera-exposure";
import { useCameraStore } from "@/lib/simulator/camera-store";
import type { CaptureResult, PhotoStarRating as PhotoStarRatingValue } from "@/lib/simulator/camera-exposure";
import {
  saveCaptureToServer,
  updateSimulatorCaptureStars,
} from "@/lib/simulator/simulator-captures-api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GalleryStarFilter = "all" | "unrated" | PhotoStarRatingValue;

const FILTER_OPTIONS: { id: GalleryStarFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "unrated", label: "Sin clasificar" },
  { id: 5, label: "5 ★" },
  { id: 4, label: "4 ★" },
  { id: 3, label: "3 ★" },
  { id: 2, label: "2 ★" },
  { id: 1, label: "1 ★" },
];

export interface SimulatorPhotoGalleryProps {
  open: boolean;
  onClose: () => void;
}

export default function SimulatorPhotoGallery({ open, onClose }: SimulatorPhotoGalleryProps) {
  const { gallery, setPhotoStars, sessionUser, patchCapture } = useCameraStore();
  const [filter, setFilter] = useState<GalleryStarFilter>("all");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return gallery;
    if (filter === "unrated") return gallery.filter((p) => p.stars === 0);
    return gallery.filter((p) => p.stars === filter);
  }, [gallery, filter]);

  const activeIndex = useMemo(() => {
    if (!filtered.length) return -1;
    if (activeId !== null) {
      const idx = filtered.findIndex((p) => p.id === activeId);
      if (idx >= 0) return idx;
    }
    return filtered.length - 1;
  }, [filtered, activeId]);

  const activePhoto = activeIndex >= 0 ? filtered[activeIndex] : null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    if (gallery.length > 0) {
      setActiveId((prev) => prev ?? gallery[gallery.length - 1].id);
    }
  }, [open, gallery]);

  useEffect(() => {
    if (!open) return;
    setSaveState(activePhoto?.savedToServer ? "saved" : "idle");
    setSaveError(null);
  }, [open, activePhoto?.id, activePhoto?.savedToServer]);

  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) {
      setActiveId(null);
      return;
    }
    if (activeId === null || !filtered.some((p) => p.id === activeId)) {
      setActiveId(filtered[filtered.length - 1].id);
    }
  }, [open, filtered, activeId]);

  const goPrev = useCallback(() => {
    if (filtered.length < 2) return;
    const idx = activeIndex <= 0 ? filtered.length - 1 : activeIndex - 1;
    setActiveId(filtered[idx].id);
  }, [filtered, activeIndex]);

  const goNext = useCallback(() => {
    if (filtered.length < 2) return;
    const idx = activeIndex >= filtered.length - 1 ? 0 : activeIndex + 1;
    setActiveId(filtered[idx].id);
  }, [filtered, activeIndex]);

  const handleStarsChange = useCallback(
    (photo: CaptureResult, stars: PhotoStarRatingValue) => {
      setPhotoStars(photo.id, stars);
      if (photo.serverId) {
        void updateSimulatorCaptureStars(photo.serverId, stars).catch(() => undefined);
      }
    },
    [setPhotoStars],
  );

  const handleSave = useCallback(async () => {
    if (!activePhoto?.previewUrl) return;
    if (!sessionUser) {
      setSaveError("Iniciá sesión para guardar tus fotos durante 7 días.");
      setSaveState("error");
      return;
    }
    if (activePhoto.savedToServer && activePhoto.serverId) {
      setSaveState("saved");
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    try {
      const record = await saveCaptureToServer(activePhoto, sessionUser);
      patchCapture(activePhoto.id, {
        serverId: record.id,
        savedToServer: true,
        previewUrl: record.imageUrl,
        takenBy: sessionUser,
      });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la foto");
    }
  }, [activePhoto, sessionUser, patchCapture]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, goPrev, goNext]);

  if (!open) return null;

  return (
    <div className="cod-gallery-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cod-gallery-modal cod-gallery-modal--with-sidebar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cod-gallery-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cod-gallery-modal__header">
          <div>
            <h2 id="cod-gallery-title" className="cod-gallery-modal__title">
              Galería de fotos
            </h2>
            <p className="cod-gallery-modal__subtitle">
              {gallery.length} foto{gallery.length === 1 ? "" : "s"} tomada{gallery.length === 1 ? "" : "s"}
              {sessionUser ? " · guardadas 7 días en tu cuenta" : " · iniciá sesión para guardarlas 7 días"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cod-gallery-modal__close"
            onClick={onClose}
            aria-label="Cerrar galería"
          >
            ×
          </button>
        </header>

        {!sessionUser ? (
          <div className="cod-gallery-login-banner" role="status">
            <p>
              Para guardar tus fotos y ver los metadatos con tu usuario,{" "}
              <Link href="/login?redirect=/camofduty/simulador" className="cod-gallery-login-banner__link">
                iniciá sesión
              </Link>
              .
            </p>
          </div>
        ) : null}

        <div className="cod-gallery-modal__filters" role="toolbar" aria-label="Filtrar por estrellas">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={String(option.id)}
              type="button"
              className={`cod-gallery-filter${filter === option.id ? " cod-gallery-filter--active" : ""}`}
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="cod-gallery-empty" role="status">
            <p className="cod-gallery-empty__title">
              {gallery.length === 0 ? "Todavía no tomaste fotos" : "Ninguna foto con este filtro"}
            </p>
            <p className="cod-gallery-empty__hint">
              {gallery.length === 0
                ? "Usá Espacio en la escena para disparar y ver tus capturas acá."
                : "Probá otro filtro de estrellas o clasificá tus fotos."}
            </p>
          </div>
        ) : (
          <div className="cod-gallery-body">
            <div className="cod-gallery-main">
              <div className="cod-gallery-viewer">
                <button
                  type="button"
                  className="cod-gallery-nav cod-gallery-nav--prev"
                  onClick={goPrev}
                  aria-label="Foto anterior"
                  disabled={filtered.length < 2}
                >
                  ‹
                </button>

                <div className="cod-gallery-viewer__stage">
                  {activePhoto?.previewUrl ? (
                    <img
                      src={activePhoto.previewUrl}
                      alt={`Foto ${activePhoto.id}`}
                      className="cod-gallery-viewer__img"
                    />
                  ) : (
                    <div className="cod-gallery-viewer__pending">Procesando captura…</div>
                  )}
                </div>

                <button
                  type="button"
                  className="cod-gallery-nav cod-gallery-nav--next"
                  onClick={goNext}
                  aria-label="Foto siguiente"
                  disabled={filtered.length < 2}
                >
                  ›
                </button>
              </div>

              {activePhoto ? (
                <div className="cod-gallery-meta">
                  <div className="cod-gallery-meta__info">
                    <p className="cod-gallery-meta__verdict">{verdictLabel(activePhoto.verdict)}</p>
                    <p className="cod-gallery-meta__ev">{activePhoto.evLabel}</p>
                    <p className="cod-gallery-meta__index">
                      {activeIndex + 1} / {filtered.length}
                    </p>
                  </div>

                  <PhotoStarRating
                    value={activePhoto.stars}
                    onChange={(stars) => handleStarsChange(activePhoto, stars)}
                    label="Clasificar foto"
                  />

                  <div className="cod-gallery-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => void handleSave()}
                      disabled={!activePhoto.previewUrl || saveState === "saving"}
                      className="cod-gallery-actions__btn"
                    >
                      {saveState === "saving"
                        ? "Guardando…"
                        : activePhoto.savedToServer || saveState === "saved"
                          ? "Guardada en la nube"
                          : "Guardar foto"}
                    </Button>
                  </div>
                  {saveError ? (
                    <p className="cod-gallery-actions__error" role="alert">
                      {saveError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <ul className="cod-gallery-thumbs" aria-label="Miniaturas">
                {filtered.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      className={`cod-gallery-thumb${photo.id === activePhoto?.id ? " cod-gallery-thumb--active" : ""}`}
                      onClick={() => setActiveId(photo.id)}
                      aria-label={`Ver foto ${photo.id}${photo.stars ? `, ${photo.stars} estrellas` : ""}`}
                      aria-current={photo.id === activePhoto?.id ? "true" : undefined}
                    >
                      {photo.previewUrl ? (
                        <img src={photo.previewUrl} alt="" className="cod-gallery-thumb__img" />
                      ) : (
                        <span className="cod-gallery-thumb__pending" aria-hidden="true" />
                      )}
                      {photo.stars > 0 ? (
                        <span className="cod-gallery-thumb__stars" aria-hidden="true">
                          {photo.stars}★
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {activePhoto ? <CaptureMetadataPanel photo={activePhoto} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
