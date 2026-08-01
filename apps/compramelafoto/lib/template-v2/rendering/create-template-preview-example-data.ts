import { SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS } from "@repo/template-engine";

/**
 * Datos de ejemplo no sensibles para preview.
 * No consulta pedidos, alumnos ni clientes reales.
 */
export function createTemplatePreviewExampleData(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const nested: Record<string, unknown> = {
    student: { fullName: "Nombre Apellido" },
    buyer: { fullName: "Cliente Ejemplo" },
    school: { name: "Escuela de ejemplo" },
    course: { displayName: "3.º B · Mañana" },
    order: {
      referenceShort: "P-0001",
      fulfillmentQrUrl: "",
    },
    photographer: { displayName: "Estudio Ejemplo" },
    event: { dateFormatted: "01/01/2026" },
    branding: { schoolLogoUrl: "" },
  };

  // Flat paths desde registry (compat resolución)
  const flat: Record<string, unknown> = {};
  for (const def of SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS) {
    if (def.example != null && def.example !== "") {
      flat[def.path] = def.example;
    }
  }

  return {
    ...nested,
    ...flat,
    ...(overrides ?? {}),
  };
}
