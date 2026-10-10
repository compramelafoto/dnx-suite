/**
 * Los mensajes y los saludos grabados pasan **una vez**; las fotos vuelven.
 *
 * Un saludo repitiéndose toda la noche cada diez fotos cansa, y hace que el salón deje
 * de mirar la pantalla justo cuando aparece algo nuevo. Con un audio es peor todavía:
 * vuelve a sonar la misma voz por los parlantes.
 *
 * Las fotos sí vuelven: son el contenido, y en una fiesta de cuatro horas con treinta
 * fotos no hay otra cosa.
 *
 * Sacarlos de la lista alcanza y no hace falta recordar cuáles se vieron: el canal en
 * vivo sólo manda lo que llegó **después** del cursor, así que un mensaje que ya pasó no
 * vuelve a entrar ni cuando la pantalla se reconecta.
 */

type ConTipo = { tipo: "FOTO" | "MENSAJE" | "AUDIO"; id: string };

export function sacarSiYaSeVio<T extends ConTipo>(lista: T[], mostrado: T | undefined): T[] {
  if (!mostrado || mostrado.tipo === "FOTO") return lista;
  if (!lista.some((i) => i.id === mostrado.id)) return lista;

  return lista.filter((i) => i.id !== mostrado.id);
}
