import type { ContestRulesConfiguration } from "./types";
import { buildContestRulesGenerationInput } from "./generation-input";
import { validateContestRulesConfiguration } from "./validate";
import { hashContestRulesConfiguration } from "./hash";

/**
 * Prompt completo para ChatGPT (sin llamar API). P0-09B.
 */
export function buildChatGptRulesPrompt(config: ContestRulesConfiguration): string {
  const input = buildContestRulesGenerationInput(config);
  const validation = validateContestRulesConfiguration(config);
  const pending = validation.findings.filter((f) => f.severity === "pending_human");
  const configurationHash = hashContestRulesConfiguration(config);
  const identity = config.identity;
  const schedule = config.schedule;
  const part = config.participation;

  return [
    "Sos un redactor legal-técnico de bases de concursos fotográficos en Argentina.",
    "Debés redactar las Bases y Condiciones del concurso descrito abajo.",
    "",
    "REGLAS OBLIGATORIAS:",
    "1. No inventes reglas que no estén en el JSON ni en el resumen.",
    "2. No modifiques fechas ni conviertas recomendaciones (EXIF/GPS) en obligaciones.",
    "3. No omitas decisiones relevantes; si falta un dato, listalo en missingDecisions.",
    "4. Diferenciá IA generativa (prohibida si así está configurado) de IA asistida no generativa.",
    "5. Diferenciá límites reglamentarios de límites técnicos internos (estos NO van como regla del concurso).",
    "6. Usá lenguaje claro e institucional en español argentino; artículos numerados.",
    "7. Identificá contradicciones potenciales (p. ej. licencia) sin resolverlas inventando texto.",
    "8. No incluyas secretos, IDs internos, storage keys, tokens ni datos personales.",
    "9. El documento legal puede ser Markdown.",
    "",
    "RESUMEN OBLIGATORIO A CUBRIR:",
    `- Identidad: ${identity.officialName}`,
    `- Organizadores: ${identity.organizers.map((o) => o.name).join("; ")}`,
    `- Territorio: ${identity.territoryScope ?? identity.province ?? "—"}`,
    `- Cronograma: apertura ${schedule.registrationOpensAt}; cierre exclusivo ${schedule.registrationClosesAtExclusive}`,
    `- Captura: ${schedule.publicScheduleNote ?? "ver JSON"}`,
    `- Participación: modalidad ${part.pricingMode}; edad mínima ${part.minAge}; obras ${part.maxEntriesPerRegistration}; categorías ${part.maxCategoriesPerRegistration}`,
    `- Menores: autorización adulto ${String(part.adultAuthorizationRequired)}`,
    `- Categorías: ${config.categories.map((c) => c.name).join(", ")}`,
    `- Archivo: MIME ${config.file.supportedMimeTypes.join(", ")}; sin límites reglamentarios inventados`,
    `- Metadatos: EXIF/GPS/fecha/dispositivo según JSON (recomendados ≠ obligatorios)`,
    `- Edición / IA / Derechos / Licencia / Premios / Jurado / Descalificaciones / Privacidad / Contacto: ver JSON`,
    "",
    `Hash de configuración (declaredConfigurationHash): ${configurationHash}`,
    `Estado de validación: ${validation.status}`,
    pending.length
      ? `Decisiones humanas pendientes:\n${pending.map((p) => `- ${p.message}`).join("\n")}`
      : "Sin pendientes humanos detectados por el validador.",
    "",
    "SALIDA OBLIGATORIA: devolvé ÚNICAMENTE un JSON válido con esta forma:",
    "```json",
    JSON.stringify(
      {
        documentTitle: "...",
        rulesDocument: "...",
        configurationSummary: {},
        missingDecisions: [],
        warnings: [],
        declaredConfigurationHash: configurationHash,
        sectionsCovered: [],
      },
      null,
      2,
    ),
    "```",
    "",
    "JSON DE CONFIGURACIÓN (fuente de verdad):",
    "```json",
    JSON.stringify(input, null, 2),
    "```",
  ].join("\n");
}
