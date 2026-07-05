/** Solicita captura del fotograma WebGL con exposición de foto. */
export const COD_CAPTURE_FRAME_EVENT = "cod-capture-frame";

export interface CodCaptureFrameDetail {
  shutterSpeed: string;
  aperture: number;
  focusDistanceM: number;
}

/** Entrega la imagen capturada (data URL) y metadata pedagógica. */
export const COD_CAPTURE_IMAGE_EVENT = "cod-capture-image";

export interface CodCaptureImageDetail {
  url: string;
  pedagogyNotes?: string[];
  panningMatch?: number;
  zoomChangedDuringExposure?: boolean;
  startFocalLength?: number;
  endFocalLength?: number;
}
