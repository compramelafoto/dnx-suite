export type SectionStatus = "present" | "incomplete" | "absent" | "contradictory";

export type RulesSectionCheck = {
  id: string;
  label: string;
  status: SectionStatus;
  evidence?: string;
};

export const REQUIRED_RULES_SECTIONS: Array<{ id: string; label: string; patterns: RegExp[] }> = [
  { id: "presentation", label: "Presentación", patterns: [/bases\s+y\s+condiciones|presentaci[oó]n/i] },
  { id: "organizers", label: "Organizadores", patterns: [/organizador/i, /sociedad de fot[oó]grafos/i, /c[aá]mara de senadores/i] },
  { id: "object", label: "Objeto", patterns: [/objeto|finalidad del concurso/i] },
  { id: "participants", label: "Participantes", patterns: [/participante/i] },
  { id: "minors", label: "Menores", patterns: [/menor|tutor|autorizaci[oó]n/i] },
  { id: "free", label: "Gratuidad", patterns: [/gratuit|sin costo/i] },
  { id: "territory", label: "Territorio", patterns: [/santa\s*fe|residencia|territorio/i] },
  { id: "schedule", label: "Cronograma", patterns: [/agosto|septiembre|cronograma|inscripci[oó]n/i] },
  { id: "categories", label: "Categorías", patterns: [/categor[ií]a/i] },
  { id: "works_count", label: "Cantidad de obras", patterns: [/fotograf[ií]a|obra/i] },
  { id: "theme", label: "Temática", patterns: [/tem[aá]tica|deporte santafesino/i] },
  { id: "technical", label: "Requisitos técnicos", patterns: [/formato|jpeg|png|webp|t[eé]cnic/i] },
  { id: "metadata", label: "Metadatos", patterns: [/exif|gps|metadato/i] },
  { id: "editing", label: "Edición", patterns: [/revelado|edici[oó]n|fotomontaje/i] },
  { id: "ai", label: "IA", patterns: [/inteligencia artificial|\bia\b/i] },
  { id: "authorship", label: "Autoría", patterns: [/autor[ií]a|titularidad/i] },
  { id: "image_rights", label: "Derechos de imagen", patterns: [/derechos?\s+de\s+imagen|terceros/i] },
  { id: "license", label: "Licencia", patterns: [/licencia|exclusiv/i] },
  { id: "heritage", label: "Archivo patrimonial", patterns: [/patrimonial|archivo hist[oó]rico|conservaci[oó]n/i] },
  { id: "jury", label: "Jurado", patterns: [/jurado/i] },
  { id: "coi", label: "Conflicto de interés", patterns: [/conflicto de inter[eé]s/i] },
  { id: "prizes", label: "Premios", patterns: [/premio|500\.?000/i] },
  { id: "disqualification", label: "Descalificación", patterns: [/descalific/i] },
  { id: "privacy", label: "Privacidad", patterns: [/privacidad|datos personales/i] },
  { id: "communications", label: "Comunicaciones", patterns: [/comunicaci[oó]n|notificaci[oó]n/i] },
  { id: "acceptance", label: "Aceptación", patterns: [/aceptaci[oó]n|aceptar las bases/i] },
  { id: "force_majeure", label: "Fuerza mayor", patterns: [/fuerza mayor/i] },
  { id: "contact", label: "Contacto", patterns: [/contacto|correo|email/i] },
];

export function buildSectionsChecklist(text: string): RulesSectionCheck[] {
  return REQUIRED_RULES_SECTIONS.map((s) => {
    const hit = s.patterns.some((p) => p.test(text));
    return {
      id: s.id,
      label: s.label,
      status: hit ? "present" : "absent",
    };
  });
}

export function missingRequiredSections(checks: RulesSectionCheck[]): RulesSectionCheck[] {
  return checks.filter((c) => c.status === "absent" || c.status === "incomplete");
}
