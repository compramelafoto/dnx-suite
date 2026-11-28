/** «¿Sos fotógrafo?»: sí -> PHOTOGRAPHER, no -> CUSTOMER. Sólo vale para cuentas nuevas. */
export function rolSegunRespuesta(
  respuesta: string | null | undefined,
): "PHOTOGRAPHER" | "CUSTOMER" | null {
  if (respuesta === "si") return "PHOTOGRAPHER";
  if (respuesta === "no") return "CUSTOMER";
  return null;
}
