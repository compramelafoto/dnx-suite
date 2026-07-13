import type { PhotoRole, StoryType } from "./types";

export const STORY_TYPE_OPTIONS: { value: StoryType; label: string; hint: string }[] = [
  { value: "cobertura", label: "Cobertura", hint: "Relato del evento con material fotográfico" },
  { value: "cronica", label: "Crónica", hint: "Narración con voz y ambiente" },
  { value: "previa", label: "Previa", hint: "Antes del evento" },
  { value: "resultados", label: "Resultados", hint: "Cierre, podio, números" },
  { value: "comunicado", label: "Comunicado", hint: "Texto institucional o de prensa" },
  { value: "galeria", label: "Galería", hint: "La historia son las fotos" },
  { value: "entrevista", label: "Entrevista", hint: "Preguntas y respuestas" },
  { value: "otro", label: "Otro", hint: "Otro formato periodístico" },
];

export function storyTypeLabel(type: StoryType | null | undefined): string {
  if (!type) return "Sin definir";
  return STORY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function commercialStatusLabel(status: string): string {
  switch (status) {
    case "AVAILABLE":
      return "Disponible";
    case "REACTIVATABLE":
      return "Reactivable";
    case "UNAVAILABLE":
      return "No disponible";
    default:
      return "Por confirmar";
  }
}

export function photoRoleLabel(role: PhotoRole): string {
  switch (role) {
    case "COVER":
      return "Portada";
    case "GALLERY":
      return "Galería";
    case "INLINE":
      return "Para insertar";
  }
}

export function eventStatusLabel(input: {
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const start = input.startsAt ? new Date(input.startsAt) : null;
  const end = input.endsAt ? new Date(input.endsAt) : null;
  if (start && !Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
    return "Próximo";
  }
  if (
    start &&
    !Number.isNaN(start.getTime()) &&
    start.getTime() <= now.getTime() &&
    (!end || end.getTime() >= now.getTime())
  ) {
    return "En curso";
  }
  if (end && !Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
    return "Finalizado";
  }
  if (start && !Number.isNaN(start.getTime()) && start.getTime() < now.getTime()) {
    return "Finalizado";
  }
  return "Sin fecha";
}

export function formatEventDate(value: string | null | undefined): string {
  if (!value) return "Fecha a confirmar";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Fecha a confirmar";
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildDraftContentStub(input: {
  storyTypeLabel: string;
  eventTitle?: string | null;
  coverageTitles?: string[];
  photographerNames?: string[];
}): string {
  const lines: string[] = [
    `## ${input.storyTypeLabel}`,
    "",
  ];
  if (input.eventTitle) {
    lines.push(`Evento: ${input.eventTitle}`, "");
  }
  if (input.coverageTitles?.length) {
    lines.push(
      "Material editorial:",
      ...input.coverageTitles.map((t) => `- ${t}`),
      "",
    );
  }
  if (input.photographerNames?.length) {
    lines.push(
      "Fotógrafos:",
      ...input.photographerNames.map((n) => `- ${n}`),
      "",
    );
  }
  lines.push("Escribí acá el cuerpo de la historia.", "");
  return lines.join("\n");
}
