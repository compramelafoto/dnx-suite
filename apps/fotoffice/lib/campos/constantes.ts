/** Tipos de registro que hoy admiten campos personalizados. */
export const TIPOS_REGISTRO_ACTIVOS = ["CLIENTE", "SOCIO", "CONSULTA", "PROYECTO"] as const;
/** Activos + reservados (módulos que todavía no existen; no se ofrecen en la UI). */
export const TIPOS_REGISTRO = [...TIPOS_REGISTRO_ACTIVOS, "PRESUPUESTO", "PEDIDO", "CONTRATO"] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];
export type TipoRegistroActivo = (typeof TIPOS_REGISTRO_ACTIVOS)[number];

export const TIPOS_CAMPO = ["TEXTO", "TEXTO_LARGO", "NUMERO", "FECHA", "SI_NO", "LISTA", "ENLACE"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ETIQUETA_TIPO_CAMPO: Record<TipoCampo, string> = {
  TEXTO: "Texto corto",
  TEXTO_LARGO: "Texto largo",
  NUMERO: "Número",
  FECHA: "Fecha",
  SI_NO: "Sí/No",
  LISTA: "Lista",
  ENLACE: "Enlace",
};

/** Máximo de campos activos por tipo de registro. */
export const MAX_CAMPOS = 40;
export const MAX_NOMBRE_CAMPO = 60;
export const MAX_TEXTO = 200;
export const MAX_TEXTO_LARGO = 4000;
export const MAX_ENLACE = 500;
export const MAX_CLAVE = 40;
