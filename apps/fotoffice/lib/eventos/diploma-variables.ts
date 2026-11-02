import type { VariableDeclaration } from "@repo/design-studio";

/**
 * Las variables del diploma de un evento, con las mismas claves que el catálogo del diseñador
 * (`FOTOFFICE_TEMPLATE_VARIABLE_DEFINITIONS`, grupo "evento"). Opcionales: un diploma sin lugar
 * o sin tipo de entrada igual se emite.
 *
 * Se suman también a los contratos del carnet y de las placas, porque el diseñador las ofrece en
 * todas las plantillas de FOTOFFICE y la emisión rechaza cualquier marcador que el contrato no
 * declare: sin esto, alguien que las arrastrara a un carnet lo dejaría sin poder imprimirse.
 */
export const EVENTO_VARIABLES: VariableDeclaration[] = [
  { key: "attendeeName", type: "text", label: "Nombre del asistente", required: false, sampleValue: "María Fernanda Gómez" },
  { key: "eventName", type: "text", label: "Evento", required: false, sampleValue: "Rafaela en Foco 2026" },
  { key: "eventDate", type: "text", label: "Fecha del evento", required: false, sampleValue: "1 y 2 de noviembre de 2026" },
  { key: "eventPlace", type: "text", label: "Lugar del evento", required: false, sampleValue: "Centro Cultural Viejo Mercado, Rafaela" },
  { key: "ticketType", type: "text", label: "Tipo de entrada", required: false, sampleValue: "General" },
  { key: "attendeeCode", type: "text", label: "Código del asistente", required: false, sampleValue: "AB7K2M" },
];
