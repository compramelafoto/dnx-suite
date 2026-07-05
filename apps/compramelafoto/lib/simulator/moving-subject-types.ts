/** Identificadores de sujetos móviles enfocables. */
export const MOVING_SUBJECT_ID = "moving-subject";
export const VEHICLE_SUBJECT_ID = "vehicle-1";
/** Auto principal — Ciudad Fotográfica. */
export const PHOTOGRAPHIC_VEHICLE_SUBJECT_ID = "vehicle-main";
/** Peatón principal — Ciudad Fotográfica. */
export const PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_ID = "pedestrian-main";
/** Peatón vereda oeste — Ciudad Fotográfica. */
export const PHOTOGRAPHIC_PEDESTRIAN_02_SUBJECT_ID = "pedestrian-02";
/** Peatón sentado — retrato estático. */
export const PHOTOGRAPHIC_PEDESTRIAN_SEATED_SUBJECT_ID = "pedestrian-seated";

export const PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_IDS = [
  PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_ID,
  PHOTOGRAPHIC_PEDESTRIAN_02_SUBJECT_ID,
  PHOTOGRAPHIC_PEDESTRIAN_SEATED_SUBJECT_ID,
] as const;

export function isPhotographicPedestrianId(id: string | null | undefined): boolean {
  return (
    typeof id === "string" &&
    PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_IDS.includes(id as (typeof PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_IDS)[number])
  );
}

export const PEDESTRIAN_SUBJECT_IDS = ["ped-1", "ped-2", "ped-3", "ped-4"] as const;

export type PedestrianSubjectId = (typeof PEDESTRIAN_SUBJECT_IDS)[number];

export type MovingSubjectKind = "human" | "vehicle" | "generic";

export interface MovingSubjectState {
  id: string;
  /** Tipo semántico para AF y barrido. */
  subjectKind?: MovingSubjectKind;
  /** Posición mundial [x, y, z] en metros. */
  position: [number, number, number];
  /** Velocidad escalar m/s. */
  speed: number;
  /** Sentido lateral: 1 = +X, -1 = −X (legacy estudio). */
  direction: 1 | -1;
  /** Velocidad con signo en X (m/s). */
  velocityX: number;
  /** Velocidad 3D (m/s) — seguimiento futuro. */
  velocity?: [number, number, number];
  visible: boolean;
}

export function findMovingSubject(
  subjects: MovingSubjectState[],
  id: string | null,
): MovingSubjectState | null {
  if (!id) return null;
  return subjects.find((s) => s.id === id && s.visible) ?? null;
}
