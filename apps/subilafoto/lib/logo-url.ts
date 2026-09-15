import "server-only";

import { DURACION, enlaceParaMirar } from "@/lib/moderacion/vista";
import { esClaveDeLogo } from "./logo";

/**
 * La dirección para mostrar el logo.
 *
 * El campo guarda dos cosas distintas: una dirección que el fotógrafo pegó, o una clave de
 * nuestro bucket si subió el archivo. Sólo las claves se firman.
 *
 * Se firma largo —lo que dura un evento— porque estas páginas las abre un cliente que
 * puede dejarlas un rato antes de pagar, y un logo roto en la pantalla de la compra es
 * exactamente donde no conviene.
 *
 * El logo se muestra siempre dentro de un `<img>`. Importa para el SVG: un SVG en un `img`
 * no ejecuta nada, y además se sirve desde el dominio del bucket y no del nuestro.
 */
export async function urlDelLogo(valor: string | null): Promise<string | null> {
  if (!valor) return null;
  if (esClaveDeLogo(valor)) return enlaceParaMirar(valor, DURACION.proyeccion);
  // Lo que no es una clave nuestra se muestra tal cual. Que sea `https` ya lo revisó
  // `revisarPerfil` antes de guardarlo.
  return valor.startsWith("https://") ? valor : null;
}
