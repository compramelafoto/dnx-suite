/**
 * La dirección a la que lleva un botón del sitio público, a partir de lo que se escribió en el
 * editor. PURO.
 *
 * El campo es texto libre y la gente escribe de todo: `w/sfpr/asociarse` sin la barra inicial
 * (el navegador lo resuelve contra la página actual y termina en `/w/sfpr/w/sfpr/asociarse`, un
 * 404), `www.estudio.com` sin `https://` (lo mismo), o cualquier cosa pegada de otro lado. Acá
 * se corrige lo que tiene una sola lectura posible y se descarta lo que no es una dirección.
 *
 * Nunca deja pasar `javascript:`, `data:` ni `vbscript:`: el sitio es público y lo que diga el
 * botón se ejecutaría en el navegador de cualquiera que lo toque.
 */
export function enlaceDeBoton(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;

  if (/^(javascript|data|vbscript):/i.test(texto.replace(/\s+/g, ""))) return null;
  if (texto.startsWith("#") || texto.startsWith("/")) return texto;
  if (/^(https?:|mailto:|tel:)/i.test(texto)) return texto;
  // Cualquier otro esquema (`ftp:`, `file:`…) no es algo que un botón del sitio deba abrir.
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return null;

  // Un dominio escrito a mano: `www.algo.com` o `algo.com.ar/ruta`.
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$|\?)/i.test(texto)) return `https://${texto}`;

  // Una ruta del propio sitio a la que le falta la barra inicial.
  return `/${texto}`;
}
