/**
 * Cómo se nombra a un ganador fuera del portal: nombre completo e inicial del apellido.
 * "Daniel Andrés" + "Cuart" → "Daniel Andrés C." PURO.
 *
 * Alcanza para reconocerse en el salón donde se proyecta el sorteo y no deja el apellido de
 * nadie publicado en internet. Si la ficha ya no existe se usa la instantánea del padrón, que
 * guarda "Nombre Apellido" junto: se toma la última palabra como apellido.
 */
export function nombrePublico(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fullNameSnapshot: string,
): string {
  const nombre = firstName?.trim();
  const apellido = lastName?.trim();
  if (nombre) return apellido ? `${nombre} ${inicial(apellido)}` : nombre;

  const partes = fullNameSnapshot.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  const ultimo = partes.pop() as string;
  return `${partes.join(" ")} ${inicial(ultimo)}`;
}

function inicial(apellido: string): string {
  const letra = apellido.charAt(0).toLocaleUpperCase("es-AR");
  return letra ? `${letra}.` : "";
}
