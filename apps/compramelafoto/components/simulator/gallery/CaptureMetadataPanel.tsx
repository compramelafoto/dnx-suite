"use client";

import type { CaptureResult } from "@/lib/simulator/camera-exposure";
import {
  captureDisplayName,
  formatCaptureDateTime,
  SIMULATOR_CAPTURE_RETENTION_DAYS,
} from "@/lib/simulator/capture-metadata";
import {
  formatAperture,
  formatExposureMode,
  formatShutterSpeed,
  formatWhiteBalance,
  UI_LABEL_EXPOSURE_TIME,
} from "@/lib/simulator/camera-settings";
import { verdictLabel } from "@/lib/simulator/camera-exposure";

export interface CaptureMetadataPanelProps {
  photo: CaptureResult;
}

export default function CaptureMetadataPanel({ photo }: CaptureMetadataPanelProps) {
  const { date, time } = formatCaptureDateTime(photo.timestamp);
  const settings = photo.settings;

  return (
    <aside className="cod-gallery-metadata" aria-label="Metadatos de la foto">
      <h3 className="cod-gallery-metadata__title">Metadatos</h3>

      <dl className="cod-gallery-metadata__list">
        <div className="cod-gallery-metadata__row">
          <dt>Fotógrafo</dt>
          <dd>{captureDisplayName(photo.takenBy)}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Fecha</dt>
          <dd>{date}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Hora</dt>
          <dd>{time}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Retención</dt>
          <dd>
            {photo.savedToServer
              ? `${SIMULATOR_CAPTURE_RETENTION_DAYS} días en tu cuenta`
              : "Se guardará al confirmar"}
          </dd>
        </div>
      </dl>

      <h4 className="cod-gallery-metadata__section">Parámetros de cámara</h4>
      <dl className="cod-gallery-metadata__list">
        <div className="cod-gallery-metadata__row">
          <dt>Modo</dt>
          <dd>{formatExposureMode(settings.mode)}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>ISO</dt>
          <dd>{settings.iso}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>{UI_LABEL_EXPOSURE_TIME}</dt>
          <dd>{formatShutterSpeed(settings.shutterSpeed)}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Distancia focal</dt>
          <dd>{settings.focalLengthMm} mm</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Diafragma</dt>
          <dd>{formatAperture(settings.aperture)}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Balance de blancos</dt>
          <dd>{formatWhiteBalance(settings.whiteBalance)}</dd>
        </div>
        <div className="cod-gallery-metadata__row">
          <dt>Compensación EV</dt>
          <dd>
            {settings.exposureCompensation > 0 ? "+" : ""}
            {settings.exposureCompensation.toFixed(1)}
          </dd>
        </div>
        {photo.focus ? (
          <div className="cod-gallery-metadata__row">
            <dt>Enfoque</dt>
            <dd>
              {photo.focus.mode} · {photo.focus.distanceM.toFixed(1)} m
              {photo.focus.targetLabel !== "Centro" ? ` · mira ${photo.focus.targetLabel}` : ""}
            </dd>
          </div>
        ) : null}
        <div className="cod-gallery-metadata__row">
          <dt>Exposición medida</dt>
          <dd>
            {verdictLabel(photo.verdict)} ({photo.evLabel})
          </dd>
        </div>
        {typeof photo.panningMatch === "number" ? (
          <div className="cod-gallery-metadata__row">
            <dt>Barrido</dt>
            <dd>{Math.round(photo.panningMatch * 100)}%</dd>
          </div>
        ) : null}
      </dl>

      {photo.pedagogyNotes && photo.pedagogyNotes.length > 0 ? (
        <>
          <h4 className="cod-gallery-metadata__section">Notas</h4>
          <ul className="cod-gallery-metadata__notes">
            {photo.pedagogyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}
