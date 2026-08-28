import type { VariableContract } from "@repo/design-studio";

/**
 * Plantilla del carnet y su contrato de variables.
 *
 * Vive en código porque la persistencia de plantillas del módulo de diseño todavía no
 * existe. Cuando exista, esto pasa a ser una plantilla de sistema (`ownerType: SYSTEM`) que
 * cada institución duplica y edita. La forma del documento ya es la definitiva, así que la
 * migración va a ser mover el JSON, no rehacerlo.
 */

export const CARNET_TEMPLATE_KEY = "carnet-socio-v1" as const;

/** Dos años, en meses, para no depender de la duración de un año bisiesto. */
export const CARNET_VALIDITY_MONTHS = 24;

export const CARNET_VARIABLE_CONTRACT: VariableContract = {
  variables: [
    {
      key: "institutionName",
      type: "text",
      label: "Nombre de la institución",
      required: true,
      sampleValue: "Sociedad de Fotógrafos",
      maxLength: 40,
    },
    {
      key: "fullName",
      type: "text",
      label: "Nombre completo",
      required: true,
      sampleValue: "Daniel Cuart",
      maxLength: 34,
    },
    {
      key: "memberNumber",
      type: "number",
      label: "Número de socio",
      required: true,
      sampleValue: "128",
      decimals: 0,
    },
    {
      key: "cardNumber",
      type: "text",
      label: "Número de carnet",
      required: true,
      sampleValue: "C-2026-0412",
      maxLength: 16,
    },
    {
      key: "category",
      type: "text",
      label: "Categoría",
      required: false,
      sampleValue: "Socio activo",
      maxLength: 28,
    },
    {
      key: "validUntil",
      type: "date",
      label: "Vigente hasta",
      required: true,
      sampleValue: "2028-08-26",
      dateFormat: "es-AR-short",
    },
    {
      // Obligatoria a propósito: un carnet de identificación sin foto no identifica. El
      // módulo detiene la emisión si falta, que es lo que queremos.
      key: "photo",
      type: "image",
      label: "Foto del socio",
      required: true,
      sampleValue: "socios/ejemplo/foto.png",
    },
    {
      key: "verificationUrl",
      type: "qrPayload",
      label: "Enlace de verificación",
      required: true,
      sampleValue: "https://fotoffice.com/c/AB12CD34EF56GH78",
    },
    /*
     * Desde acá, las que existen para el diseñador de plantillas.
     *
     * El diseño de fábrica no las usa, pero quien arma su propia plantilla puede arrastrar
     * cualquiera de ellas al lienzo. Todas opcionales: un socio puede no tener teléfono, y un
     * carnet no debe dejar de imprimirse por eso. Las que el diseño no menciona simplemente
     * no se dibujan.
     *
     * El catálogo que ve el diseñador vive en `variable-catalog-fotoffice.ts` y usa estas
     * mismas claves. Si se agrega una allá sin agregarla acá, el diseño la ofrece y la
     * emisión la rechaza.
     */
    {
      key: "firstName",
      type: "text",
      label: "Nombre",
      required: false,
      sampleValue: "Daniel",
      maxLength: 24,
    },
    {
      key: "lastName",
      type: "text",
      label: "Apellido",
      required: false,
      sampleValue: "Cuart",
      maxLength: 24,
    },
    {
      key: "documentNumber",
      type: "text",
      label: "Documento",
      required: false,
      sampleValue: "28.114.507",
      maxLength: 16,
    },
    {
      key: "joinedAt",
      type: "date",
      label: "Socio desde",
      required: false,
      sampleValue: "2014-03-15",
      dateFormat: "es-AR-short",
    },
    {
      key: "email",
      type: "text",
      label: "Email",
      required: false,
      sampleValue: "socio@example.com",
      maxLength: 40,
    },
    {
      key: "phone",
      type: "text",
      label: "Teléfono",
      required: false,
      sampleValue: "+54 341 555-0142",
      maxLength: 24,
    },
    {
      key: "city",
      type: "text",
      label: "Ciudad",
      required: false,
      sampleValue: "Rosario",
      maxLength: 24,
    },
    {
      key: "institutionLogo",
      type: "image",
      label: "Logo de la institución",
      required: false,
      sampleValue: "instituciones/ejemplo/logo.png",
    },
  ],
};

/**
 * Documento neutral del carnet: 85,6 × 54 mm, dos caras, 3 mm de sangrado y área segura.
 * Coordenadas en milímetros, cuerpos tipográficos en puntos.
 */
export function carnetDesignDocument(): unknown {
  return {
    schemaVersion: 1,
    metadata: { name: "Carnet de socio", description: "Plantilla de sistema, versión 1" },
    format: { medium: "PRINT", width: 85.6, height: 54, dpi: 300, bleedMm: 3, safeAreaMm: 3 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          { id: "banda", type: "rect", x: 0, y: 0, width: 85.6, height: 14, fillColor: "#0f3d3d" },
          { id: "institucion", type: "text", x: 6, y: 4, width: 60, height: 6, fontId: "cinzel", fontSize: 9, fontWeight: "bold", color: "#ffffff", align: "left", content: "{{institutionName}}", maxLines: 1 },
          { id: "nombre", type: "text", x: 6, y: 22, width: 52, height: 7, fontId: "dmSans", fontSize: 11, fontWeight: "bold", color: "#111111", align: "left", content: "{{fullName}}", maxLines: 2 },
          { id: "numero", type: "text", x: 6, y: 32, width: 52, height: 5, fontId: "dmSans", fontSize: 8, color: "#555555", align: "left", content: "Socio N° {{memberNumber}}", maxLines: 1 },
          { id: "categoria", type: "text", x: 6, y: 39, width: 52, height: 5, fontId: "dmSans", fontSize: 8, color: "#555555", align: "left", content: "{{category}}", maxLines: 1 },
          { id: "foto", type: "image", x: 62, y: 20, width: 18, height: 24, variableKey: "photo", fit: "cover" },
        ],
      },
      {
        id: "dorso",
        name: "Dorso",
        background: "#ffffff",
        blocks: [
          { id: "qr", type: "qrcode", x: 6, y: 14, width: 26, height: 26, variableKey: "verificationUrl", errorCorrection: "M", quietZoneModules: 4 },
          { id: "leyenda", type: "text", x: 36, y: 16, width: 44, height: 12, fontId: "dmSans", fontSize: 7, color: "#333333", align: "left", content: "Escaneá este código para ver el estado del socio.", maxLines: 3 },
          { id: "carnet", type: "text", x: 36, y: 30, width: 44, height: 5, fontId: "dmSans", fontSize: 7, color: "#333333", align: "left", content: "Carnet {{cardNumber}}", maxLines: 1 },
          { id: "vigencia", type: "text", x: 36, y: 36, width: 44, height: 5, fontId: "dmSans", fontSize: 7, color: "#555555", align: "left", content: "Vigente hasta {{validUntil}}", maxLines: 1 },
          { id: "linea", type: "line", x: 6, y: 46, width: 74, height: 0.3, strokeColor: "#0f3d3d", strokeWidth: 0.3 },
        ],
      },
    ],
  };
}

/** Suma meses respetando el fin de mes. Todo en UTC, para no depender del servidor. */
export function addMonthsUtc(date: Date, months: number): Date {
  const anio = date.getUTCFullYear();
  const mes = date.getUTCMonth() + months;
  const dia = date.getUTCDate();
  const destino = new Date(Date.UTC(anio, mes, 1));
  // Un 31 de enero más un mes no puede caer en un 31 de febrero.
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      destino.getUTCFullYear(),
      destino.getUTCMonth(),
      Math.min(dia, ultimoDia),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}
