import type { AlbumPackAvailabilityPhase, AlbumPackType } from "@prisma/client";

export const availabilityPhaseOptions: Array<{
  value: AlbumPackAvailabilityPhase;
  label: string;
}> = [
  { value: "PRE_UPLOAD", label: "Antes de subir fotos" },
  { value: "POST_UPLOAD", label: "Después de subir fotos" },
  { value: "ALWAYS", label: "Siempre disponible" },
];

export const packTypeOptions: Array<{
  value: AlbumPackType;
  label: string;
}> = [
  { value: "DIGITAL", label: "Pack digital" },
  { value: "PRINT", label: "Producto impreso" },
  { value: "SCHOOL_FOLDER", label: "Carpeta escolar" },
];
