/** Motivos de rechazo conocidos, en una frase que la persona entiende. */
export const MOTIVOS: Record<string, string> = {
  DNI_YA_USADO: "Ese DNI ya está verificado en otra cuenta",
  DNI_DISTINTO: "El DNI no coincide con el que ya tenía verificado esta cuenta",
};

export const MOTIVO_GENERICO = "No pudimos confirmar tu identidad con las imágenes enviadas.";

/** Frase para el correo al usuario: nunca se le muestra un código crudo ni texto libre del proveedor. */
export function motivoParaUsuario(codigo: string | null | undefined): string {
  return (codigo && MOTIVOS[codigo]) || MOTIVO_GENERICO;
}
