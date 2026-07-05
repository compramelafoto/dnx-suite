export const availabilityPhaseOptions = [
  { value: "PRE_UPLOAD", label: "Antes de subir fotos" },
  { value: "POST_UPLOAD", label: "Después de subir fotos" },
  { value: "ALWAYS", label: "Siempre disponible" },
] as const;

export const packTypeOptions = [
  { value: "DIGITAL", label: "Pack digital" },
  { value: "PRINT", label: "Producto impreso" },
  { value: "SCHOOL_FOLDER", label: "Carpeta escolar" },
] as const;
