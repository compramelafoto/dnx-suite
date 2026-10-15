/**
 * Qué envíos entran en la próxima pasada de revisión.
 *
 * Existe porque faltaba lo más simple: **no volver sobre lo ya decidido**. La
 * consulta tomaba siempre los primeros de la edición sin mirar si ya se habían
 * revisado, así que apretar el botón una segunda vez repetía la misma tanda y
 * nunca llegaba a las siguientes. En la 1ª edición quedaron 2923 decisiones
 * sobre 100 fotos, con 170 sin tocar por más que se apretara.
 */

export function proximaTanda<T extends { id: string }>(input: {
  envios: T[];
  yaDecididos: Set<string>;
  porTanda: number;
}): T[] {
  if (input.porTanda <= 0) return [];
  return input.envios.filter((e) => !input.yaDecididos.has(e.id)).slice(0, input.porTanda);
}
