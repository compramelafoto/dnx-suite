/**
 * El contrato lo declara el producto (el carnet, el diploma), no la plantilla. La plantilla
 * usa los marcadores; el contrato dice qué significa cada uno y qué pasa si falta.
 */

export type VariableType = "text" | "number" | "date" | "image" | "url" | "qrPayload";

export type DateFormatId = "es-AR-short" | "es-AR-long" | "iso";

export type VariableDeclaration = {
  key: string;
  type: VariableType;
  /** Cómo se llama para una persona. Aparece en los mensajes de error y en el editor. */
  label: string;
  required: boolean;
  /**
   * Obligatorio: es lo que el editor muestra mientras se diseña, y contra esto se valida
   * el largo al publicar.
   */
  sampleValue: string;
  /** Solo `text`. Se controla al publicar, no al emitir. */
  maxLength?: number;
  /** Solo `date`. Sin esto no se sabe cómo escribirla. */
  dateFormat?: DateFormatId;
  /** Solo `number`. Cantidad de decimales. */
  decimals?: number;
};

export type VariableContract = {
  variables: VariableDeclaration[];
};

/** Lo que entrega el producto en cada emisión. */
export type VariableValues = Record<string, string | number | Date | null | undefined>;

export type ResolvedVariables = {
  /** Ya convertidas a texto, listas para interpolar. */
  values: Record<string, string>;
  /** Opcionales que no vinieron. Se registran en la emisión. */
  omitted: string[];
};

export function findDeclaration(
  contract: VariableContract,
  key: string,
): VariableDeclaration | undefined {
  return contract.variables.find((v) => v.key === key);
}
