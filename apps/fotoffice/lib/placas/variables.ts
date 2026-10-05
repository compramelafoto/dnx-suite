import type { VariableDeclaration } from "@repo/design-studio";

/**
 * Los datos que existen sólo para las placas de Comunicación.
 *
 * Se suman al contrato del carnet y el carnet a este: el catálogo del diseñador es uno solo
 * para toda la institución, y la emisión rechaza cualquier marcador que su contrato no declare.
 * Si una variable de placa no estuviera en el contrato del carnet, alguien podría arrastrarla al
 * carnet y la credencial dejaría de imprimirse.
 *
 * Todas opcionales: una placa no deja de salir porque un socio no haya cargado su Instagram. Lo
 * que falta no se dibuja.
 *
 * Las claves coinciden con `packages/template-engine/src/plugins/fotoffice/definitions.ts`,
 * que es lo que ve el editor.
 */
export const PLACA_ONLY_VARIABLES: VariableDeclaration[] = [
  {
    key: "profilePhoto",
    type: "image",
    label: "Foto de perfil",
    required: false,
    sampleValue: "socios/ejemplo/perfil.png",
  },
  {
    key: "initials",
    type: "text",
    label: "Iniciales",
    required: false,
    sampleValue: "MG",
    maxLength: 3,
  },
  {
    key: "zone",
    type: "text",
    label: "Zona",
    required: false,
    sampleValue: "Rosario, Santa Fe",
    maxLength: 48,
  },
  {
    key: "specialty",
    type: "text",
    label: "Especialidad",
    required: false,
    sampleValue: "Casamientos · Retrato",
    maxLength: 60,
  },
  {
    key: "instagramHandle",
    type: "text",
    label: "Instagram",
    required: false,
    sampleValue: "@mariagomez.foto",
    maxLength: 32,
  },
  {
    key: "aboutPhrase",
    type: "text",
    label: "Frase de «Más sobre mí»",
    required: false,
    sampleValue: "Lo que más me apasiona es contar historias de familias.",
    maxLength: 160,
  },
  {
    key: "featuredPhoto1",
    type: "image",
    label: "Foto destacada 1",
    required: false,
    sampleValue: "socios/ejemplo/destacada-1.png",
  },
  {
    key: "featuredPhoto2",
    type: "image",
    label: "Foto destacada 2",
    required: false,
    sampleValue: "socios/ejemplo/destacada-2.png",
  },
  {
    key: "featuredPhoto3",
    type: "image",
    label: "Foto destacada 3",
    required: false,
    sampleValue: "socios/ejemplo/destacada-3.png",
  },
];
