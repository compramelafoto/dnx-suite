/**
 * Tipos para el asistente de bases y condiciones.
 * Estructura de datos que alimenta la generación de texto.
 */

export type RulesData = {
  identidad: IdentidadBlock;
  participacion: ParticipacionBlock;
  obras: ObrasBlock;
  formato: FormatoBlock;
  jurado: JuradoBlock;
  premios: PremiosBlock;
  derechos: DerechosBlock;
  legal: LegalBlock;
  datosPersonales: DatosPersonalesBlock;
  disposicionesFinales: DisposicionesFinalesBlock;
};

export type IdentidadBlock = {
  organizador: string;
  nombreConcurso: string;
  objeto: string;
};

export type ParticipacionBlock = {
  requisitos: string;
  exclusiones: string;
  limiteParticipaciones: string;
  fechaLimite: string;
};

export type ObrasBlock = {
  tipoObras: string;
  originalidad: string;
  ineditas: string;
};

export type FormatoBlock = {
  formatosAceptados: string;
  resolucionMinima: string;
  pesoMaximo: string;
  manipulacion: string;
};

export type JuradoBlock = {
  composicion: string;
  criterios: string;
  decision: string;
};

export type PremiosBlock = {
  premios: string;
  entrega: string;
  impuestos: string;
};

export type DerechosBlock = {
  cesion: string;
  uso: string;
  creditos: string;
};

export type LegalBlock = {
  reclamaciones: string;
  jurisdiccion: string;
};

export type DatosPersonalesBlock = {
  tratamiento: string;
  finalidad: string;
  cesionTerceros: string;
};

export type DisposicionesFinalesBlock = {
  modificacion: string;
  interpretacion: string;
  aceptacion: string;
};

export const RULES_BLOCKS: { id: keyof RulesData; label: string }[] = [
  { id: "identidad", label: "Identidad del concurso" },
  { id: "participacion", label: "Participación" },
  { id: "obras", label: "Obras" },
  { id: "formato", label: "Formato técnico" },
  { id: "jurado", label: "Jurado" },
  { id: "premios", label: "Premios" },
  { id: "derechos", label: "Derechos de autor" },
  { id: "legal", label: "Aspectos legales" },
  { id: "datosPersonales", label: "Datos personales" },
  { id: "disposicionesFinales", label: "Disposiciones finales" },
];

export const initialRulesData: RulesData = {
  identidad: {
    organizador: "",
    nombreConcurso: "",
    objeto: "",
  },
  participacion: {
    requisitos: "",
    exclusiones: "",
    limiteParticipaciones: "",
    fechaLimite: "",
  },
  obras: {
    tipoObras: "",
    originalidad: "",
    ineditas: "",
  },
  formato: {
    formatosAceptados: "",
    resolucionMinima: "",
    pesoMaximo: "",
    manipulacion: "",
  },
  jurado: {
    composicion: "",
    criterios: "",
    decision: "",
  },
  premios: {
    premios: "",
    entrega: "",
    impuestos: "",
  },
  derechos: {
    cesion: "",
    uso: "",
    creditos: "",
  },
  legal: {
    reclamaciones: "",
    jurisdiccion: "",
  },
  datosPersonales: {
    tratamiento: "",
    finalidad: "",
    cesionTerceros: "",
  },
  disposicionesFinales: {
    modificacion: "",
    interpretacion: "",
    aceptacion: "",
  },
};
