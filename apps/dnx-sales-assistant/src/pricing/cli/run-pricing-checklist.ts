import {
  defaultProfileExamplePath,
  defaultTemplatesExamplePath,
} from "../config/paths.js";
import { PRICABLE_SERVICE_TYPES } from "../models.js";

export type PricingChecklistResult = {
  exitCode: number;
  lines: string[];
};

/**
 * Checklist humana de datos a definir. Sin números sugeridos.
 */
export function runPricingChecklist(): PricingChecklistResult {
  const profileExample = defaultProfileExamplePath();
  const templatesExample = defaultTemplatesExamplePath();

  const lines = [
    "DNX pricing checklist — datos a definir (sin valores)",
    "",
    "Archivos a copiar manualmente:",
    `  ${profileExample}`,
    "  → config/pricing/dnx-pricing-profile.local.json",
    `  ${templatesExample}`,
    "  → config/pricing/dnx-service-templates.local.json",
    "",
    "### Perfil económico",
    "- [ ] id / name / updatedAt",
    "- [ ] configured = true (solo cuando esté completo)",
    "- [ ] profileVersion / formulaVersion (≠ unconfigured)",
    "- [ ] currency",
    "- [ ] commercialPositioningId",
    "- [ ] ingresos externos / vive solo de fotografía",
    "- [ ] gastos personales (al menos uno habilitado > 0)",
    "- [ ] gastos del negocio (alquiler, software, marketing, seguros, internet, telefonía, movilidad, empleados, impuestos, otros)",
    "- [ ] horas semanales totales",
    "- [ ] distribución de horas (cobertura, edición, administración, ventas, marketing, capacitación)",
    "- [ ] horas facturables (explícitas o derivadas de cobertura)",
    "- [ ] vacaciones / semanas no trabajadas (si aplica)",
    "- [ ] reservas: renovación equipo, emergencia, ahorro, vacaciones",
    "- [ ] equipo: cámaras, lentes, flashes, computadoras, discos, memorias, otros",
    "",
    "### Por servicio (plantillas)",
  ];

  for (const service of PRICABLE_SERVICE_TYPES) {
    lines.push(`#### ${service}`);
    lines.push("- [ ] configured = true");
    lines.push("- [ ] templateVersion / formulaVersion");
    lines.push("- [ ] cobertura mínima / máxima / default");
    lines.push("- [ ] edición (FIXED_HOURS | HOURS_PER_COVERAGE_HOUR | MANUAL)");
    lines.push("- [ ] horas generales del cliente");
    lines.push("- [ ] conceptos (tipo, modo de cálculo, horas, costos directos, márgenes, desgaste)");
    lines.push("- [ ] preguntas adicionales requeridas");
    lines.push("");
  }

  lines.push("### Fuera de alcance por ahora (no inventar)");
  lines.push("- viáticos, kilómetros, hospedaje");
  lines.push("- recargo por fecha / temporada / urgencia / fin de semana");
  lines.push("- fecha y ciudad: solo metadata del trabajo");
  lines.push("");
  lines.push("Validar luego con: pnpm --filter dnx-sales-assistant pricing:validate");

  return { exitCode: 0, lines };
}
