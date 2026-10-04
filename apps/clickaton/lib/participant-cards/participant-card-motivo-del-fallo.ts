/**
 * El código del fallo, con el motivo pegado atrás.
 *
 * Los registros del servidor duran minutos: si nadie está mirando en el momento exacto en que
 * una placa falla, el motivo se pierde y averiguarlo cuesta un despliegue entero. Pasó varias
 * veces mientras se ponía esto en pie. El código solo dice "el render falló", que no alcanza
 * para decidir nada.
 *
 * Va en el mismo campo y no en una columna nueva porque el esquema lo comparten cinco bases, y
 * agregar una columna obliga a tocarlas a mano una por una. El código queda **adelante**, así
 * que seguir filtrando por él sigue funcionando igual.
 */
const LARGO_MAXIMO = 320;

export function codigoConMotivo(codigo: string, motivo: string | undefined): string {
  const limpio = motivo?.replace(/\s+/g, " ").trim();
  if (!limpio) return codigo;
  return `${codigo}: ${limpio}`.slice(0, LARGO_MAXIMO);
}
