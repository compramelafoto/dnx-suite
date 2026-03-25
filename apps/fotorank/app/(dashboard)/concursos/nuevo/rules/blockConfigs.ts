import type { RuleFieldConfig } from "./RuleBlockForm";

export const IDENTIDAD_FIELDS: RuleFieldConfig[] = [
  {
    key: "organizador",
    label: "Organizador",
    placeholder: "Ej: Asociación de Fotógrafos de Buenos Aires",
    hint: "Nombre de la entidad que organiza el concurso.",
  },
  {
    key: "nombreConcurso",
    label: "Nombre del concurso",
    placeholder: "Ej: Concurso de Naturaleza 2025",
  },
  {
    key: "objeto",
    label: "Objeto del concurso",
    placeholder: "Objetivos y finalidad del concurso...",
    rows: 3,
  },
];

export const PARTICIPACION_FIELDS: RuleFieldConfig[] = [
  {
    key: "requisitos",
    label: "Requisitos para participar",
    placeholder: "Edad mínima, residencia, membresía...",
    rows: 3,
  },
  {
    key: "exclusiones",
    label: "Exclusiones",
    placeholder: "Quiénes no pueden participar...",
    rows: 2,
  },
  {
    key: "limiteParticipaciones",
    label: "Límite de participaciones",
    placeholder: "Ej: Una obra por categoría, máximo 3 categorías.",
  },
  {
    key: "fechaLimite",
    label: "Fecha límite de inscripción",
    placeholder: "Ej: 15 de abril de 2025, 23:59 hs.",
  },
];

export const OBRAS_FIELDS: RuleFieldConfig[] = [
  {
    key: "tipoObras",
    label: "Tipo de obras aceptadas",
    type: "multiselect",
    options: [
      { value: "Blanco y negro", label: "Blanco y negro" },
      { value: "Color", label: "Color" },
      { value: "Digital", label: "Digital" },
      { value: "Analógico", label: "Analógico" },
      { value: "Mixto", label: "Mixto" },
    ],
    hint: "Seleccioná los tipos permitidos.",
  },
  {
    key: "originalidad",
    label: "Originalidad",
    placeholder: "Las obras deben ser originales e inéditas...",
    rows: 2,
  },
  {
    key: "ineditas",
    label: "Condición de inéditas",
    placeholder: "No haber sido publicadas ni premiadas anteriormente...",
    rows: 2,
  },
];

export const FORMATO_FIELDS: RuleFieldConfig[] = [
  {
    key: "formatosAceptados",
    label: "Formatos de imagen aceptados",
    type: "multiselect",
    options: [
      { value: "JPG", label: "JPG / JPEG" },
      { value: "PNG", label: "PNG" },
      { value: "WebP", label: "WebP" },
      { value: "TIFF", label: "TIFF" },
      { value: "RAW", label: "RAW (DNG, CR2, NEF, etc.)" },
    ],
    hint: "Seleccioná los formatos permitidos.",
  },
  {
    key: "resolucionMinima",
    label: "Resolución mínima",
    type: "select",
    options: [
      { value: "", label: "Sin requisito" },
      { value: "1080px en el lado mayor", label: "1080px (Full HD)" },
      { value: "1920px en el lado mayor", label: "1920px (Full HD)" },
      { value: "2400px en el lado mayor", label: "2400px" },
      { value: "4K (3840px)", label: "4K (3840px)" },
      { value: "Otra (especificar en manipulación)", label: "Otra" },
    ],
  },
  {
    key: "pesoMaximo",
    label: "Peso máximo por archivo",
    type: "select",
    options: [
      { value: "", label: "Sin límite" },
      { value: "5 MB", label: "5 MB" },
      { value: "10 MB", label: "10 MB" },
      { value: "20 MB", label: "20 MB" },
      { value: "50 MB", label: "50 MB" },
      { value: "100 MB", label: "100 MB" },
    ],
  },
  {
    key: "manipulacion",
    label: "Manipulación digital",
    type: "select",
    options: [
      { value: "", label: "Sin restricción" },
      { value: "Solo archivos RAW sin procesar.", label: "Solo RAW sin procesar" },
      { value: "Ajustes básicos permitidos (exposición, contraste, recorte).", label: "Ajustes básicos" },
      { value: "Retoque permitido sin alterar la escena original.", label: "Retoque permitido" },
      { value: "Composición y montaje permitidos.", label: "Composición y montaje" },
    ],
    hint: "Otra opción: completar en descripción de obras.",
  },
];

export const JURADO_FIELDS: RuleFieldConfig[] = [
  {
    key: "composicion",
    label: "Composición del jurado",
    placeholder: "Quiénes integran el jurado y sus credenciales...",
    rows: 2,
  },
  {
    key: "criterios",
    label: "Criterios de evaluación",
    placeholder: "Originalidad, técnica, composición...",
    rows: 3,
  },
  {
    key: "decision",
    label: "Decisión del jurado",
    placeholder: "La decisión del jurado es inapelable...",
    rows: 2,
  },
];

export const PREMIOS_FIELDS: RuleFieldConfig[] = [
  {
    key: "premios",
    label: "Premios",
    placeholder: "Descripción de premios por categoría...",
    rows: 4,
  },
  {
    key: "entrega",
    label: "Entrega de premios",
    placeholder: "Fecha, lugar y modalidad de entrega...",
    rows: 2,
  },
  {
    key: "impuestos",
    label: "Impuestos",
    placeholder: "Los premios están sujetos a retenciones vigentes...",
    rows: 2,
  },
];

export const DERECHOS_FIELDS: RuleFieldConfig[] = [
  {
    key: "cesion",
    label: "Cesión de derechos",
    placeholder: "Al participar, el autor cede los derechos de...",
    rows: 3,
  },
  {
    key: "uso",
    label: "Uso de las obras",
    placeholder: "El organizador podrá utilizar las obras para...",
    rows: 2,
  },
  {
    key: "creditos",
    label: "Créditos",
    placeholder: "Se citará al autor en toda publicación...",
    rows: 2,
  },
];

export const LEGAL_FIELDS: RuleFieldConfig[] = [
  {
    key: "reclamaciones",
    label: "Reclamaciones",
    placeholder: "Plazo y forma para presentar reclamaciones...",
    rows: 2,
  },
  {
    key: "jurisdiccion",
    label: "Jurisdicción",
    placeholder: "Para toda cuestión derivada, serán competentes los tribunales de...",
    rows: 2,
  },
];

export const DATOS_PERSONALES_FIELDS: RuleFieldConfig[] = [
  {
    key: "tratamiento",
    label: "Tratamiento de datos",
    placeholder: "Los datos personales serán tratados conforme a...",
    rows: 2,
  },
  {
    key: "finalidad",
    label: "Finalidad",
    placeholder: "Gestión del concurso, comunicación de resultados...",
    rows: 2,
  },
  {
    key: "cesionTerceros",
    label: "Cesión a terceros",
    placeholder: "No se cederán datos a terceros sin consentimiento...",
    rows: 2,
  },
];

export const DISPOSICIONES_FINALES_FIELDS: RuleFieldConfig[] = [
  {
    key: "modificacion",
    label: "Modificación de bases",
    placeholder: "El organizador se reserva el derecho de modificar...",
    rows: 2,
  },
  {
    key: "interpretacion",
    label: "Interpretación",
    placeholder: "Cualquier duda será resuelta por el organizador...",
    rows: 2,
  },
  {
    key: "aceptacion",
    label: "Aceptación",
    placeholder: "La participación implica la aceptación íntegra de estas bases...",
    rows: 2,
  },
];
