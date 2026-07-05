import type { CaptureResult, PhotoStarRating } from "./camera-exposure";
import type { CaptureUserInfo, SimulatorCaptureMetadata } from "./capture-metadata";

export interface SimulatorCaptureRecord {
  id: string;
  imageUrl: string;
  capturedAt: string;
  expiresAt: string;
  stars: PhotoStarRating;
  takenByName: string | null;
  takenByEmail: string;
  metadata: SimulatorCaptureMetadata;
}

export interface SaveSimulatorCaptureInput {
  imageDataUrl: string;
  metadata: SimulatorCaptureMetadata;
  stars?: PhotoStarRating;
  capturedAt?: number;
  localClientId?: number;
}

export interface SaveSimulatorCaptureResponse {
  capture: SimulatorCaptureRecord;
}

let nextClientId = 1;

export function serverCaptureToClientResult(
  record: SimulatorCaptureRecord,
  clientId?: number,
  userId?: number,
): CaptureResult {
  const id = clientId ?? nextClientId++;
  const meta = record.metadata;
  return {
    id,
    serverId: record.id,
    timestamp: new Date(record.capturedAt).getTime(),
    settings: meta.settings,
    measuredEv: meta.measuredEv,
    verdict: meta.verdict,
    evLabel: meta.evLabel,
    previewUrl: record.imageUrl,
    pedagogyNotes: meta.pedagogyNotes,
    panningMatch: meta.panningMatch,
    stars: record.stars,
    focus: meta.focus,
    viewfinderMode: meta.viewfinderMode,
    sceneId: meta.sceneId,
    sceneLuminanceEv: meta.sceneLuminanceEv,
    savedToServer: true,
    takenBy: {
      id: userId ?? 0,
      name: record.takenByName,
      email: record.takenByEmail,
    },
  };
}

export function resetClientIdCounter(maxId: number): void {
  nextClientId = maxId + 1;
}

export async function fetchSimulatorCaptures(): Promise<SimulatorCaptureRecord[]> {
  const response = await fetch("/api/camofduty/captures", {
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 401) return [];
  if (!response.ok) {
    throw new Error("No se pudieron cargar tus fotos del simulador");
  }
  const data = (await response.json()) as { captures: SimulatorCaptureRecord[] };
  return data.captures ?? [];
}

export async function saveSimulatorCapture(
  input: SaveSimulatorCaptureInput,
): Promise<SimulatorCaptureRecord> {
  const response = await fetch("/api/camofduty/captures", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 401) {
    throw new Error("Iniciá sesión para guardar tus fotos");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo guardar la foto");
  }
  const data = (await response.json()) as SaveSimulatorCaptureResponse;
  return data.capture;
}

export async function updateSimulatorCaptureStars(
  serverId: string,
  stars: PhotoStarRating,
): Promise<void> {
  const response = await fetch(`/api/camofduty/captures/${serverId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stars }),
  });
  if (!response.ok) {
    throw new Error("No se pudo actualizar la clasificación");
  }
}

export async function saveCaptureToServer(
  photo: CaptureResult,
  sessionUser: { id: number; email: string; name: string | null },
): Promise<SimulatorCaptureRecord> {
  if (!photo.previewUrl) throw new Error("La foto aún se está procesando");
  const { embedExifInJpegDataUrl } = await import("./capture-export");
  const { buildCaptureMetadata } = await import("./capture-metadata");
  const imageDataUrl = embedExifInJpegDataUrl(photo.previewUrl, photo, sessionUser);
  return saveSimulatorCapture({
    imageDataUrl,
    metadata: buildCaptureMetadata(photo),
    stars: photo.stars,
    capturedAt: photo.timestamp,
    localClientId: photo.id,
  });
}
