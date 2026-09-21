/**
 * Consentimientos de ubicación del Centro de Transmisión.
 *
 * Versión PROPIA, separada de las Bases: agregar geolocalización no reedita
 * las Bases vigentes ni invalida las aceptaciones anteriores. Cuando la 2ª
 * edición publique sus Bases, la cláusula informativa referencia esta versión.
 */

export const CLICKATON_LOCATION_CONSENT_VERSION =
  "CLICKATON_LOCATION_2026_09_v1" as const;

export const locationConsentCopy = {
  personal:
    "Quiero que la Clickatón use la ubicación de mis fotos para armarme mi recorrido y mis estadísticas personales.",
  publicMap:
    "Soy mayor de 18 años y acepto que mi nombre y mi posición aparezcan en el mapa del evento y en la transmisión en vivo.",
  interview:
    "Acepto que el equipo de transmisión me contacte por teléfono o WhatsApp durante el evento para una entrevista.",
  revokeNote:
    "Podés dar o quitar estos permisos cuando quieras desde Mi cuenta, antes, durante y después del evento.",
} as const;
