import { createClickatonTemplateExampleData } from "@repo/template-engine/clickaton";

/**
 * Valores simulados para variables dinámicas en el lienzo del editor (diseño).
 * En pedido/preview real los datos vienen del contexto (p. ej. logo subido al dar de alta la escuela).
 */
const SCHOOL_LOGO_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <pattern id="chk" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#e2e8f0"/>
      <path d="M0 10L10 0" stroke="#cbd5e1" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="320" height="200" fill="url(#chk)"/>
  <text x="160" y="88" text-anchor="middle" fill="#475569" font-family="system-ui,sans-serif" font-size="12" font-weight="600">Logo escuela</text>
  <text x="160" y="108" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="10">Vista previa · PNG transparente en el pedido</text>
</svg>`;

export const TEMPLATE_V2_EDITOR_SCHOOL_LOGO_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SCHOOL_LOGO_PLACEHOLDER_SVG);

const clickatonFlat = createClickatonTemplateExampleData();

/**
 * Valores de ejemplo en el lienzo del editor para que `{variables}` se vean resueltas
 * (school + clickaton; el catálogo UI se filtra por metadata.product).
 */
export const TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES: Record<string, unknown> = {
  "branding.schoolLogoUrl": TEMPLATE_V2_EDITOR_SCHOOL_LOGO_PLACEHOLDER,
  "student.fullName": "María Gómez",
  "buyer.fullName": "Ana Rodríguez",
  "school.name": "Escuela Ejemplo",
  "course.displayName": "3.º B · Mañana",
  "order.referenceShort": "P-1024",
  "order.fulfillmentQrUrl": "https://ejemplo.com/escolar/entrega/preview",
  "photographer.displayName": "Estudio Fotográfico",
  "event.dateFormatted": "17/04/2026",
  ...Object.fromEntries(
    Object.entries(clickatonFlat).filter(([k]) => k.includes("."))
  ),
};
