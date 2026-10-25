/**
 * La lista de personas que el dueño pega para invitar sin cargo. Pura: sin base ni red.
 *
 * Acepta una persona por renglón, como viene de una planilla o de un correo:
 * `ana@mail.com`, `Ana Pérez, ana@mail.com`, `Ana Pérez <ana@mail.com>` o con tabulador.
 * El correo se reconoce en cualquier lugar del renglón; lo que queda es el nombre.
 */
export type Invitado = { email: string; nombre: string };
export type ListaDeInvitados = { invitados: Invitado[]; descartados: string[] };

export const MAXIMO_INVITADOS = 300;

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function leerInvitados(texto: string): ListaDeInvitados {
  const invitados: Invitado[] = [];
  const descartados: string[] = [];
  const vistos = new Set<string>();

  for (const crudo of texto.split(/\r?\n/)) {
    const renglon = crudo.trim();
    if (!renglon) continue;
    const correo = renglon.match(CORREO)?.[0];
    if (!correo) {
      descartados.push(renglon);
      continue;
    }
    const email = correo.toLowerCase();
    if (vistos.has(email)) continue;
    vistos.add(email);
    const nombre = renglon
      .replace(correo, "")
      .replace(/[<>()[\]"]/g, " ")
      .replace(/[,;\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    invitados.push({ email, nombre });
  }
  return { invitados, descartados };
}
