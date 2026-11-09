import { ETIQUETA_NICHO, ETIQUETA_TIPO } from "./etiquetas";
import type { TipoContacto } from "./tipos";

/**
 * Las instrucciones del Buscador para Claude con búsqueda web. Módulo PURO (sólo arma texto). La
 * parte fija va en `system` (igual en cada corrida, así se puede cachear) y lo que cambia
 * (provincia, ciudad, tipo, nicho, el lugar a leer) va en el mensaje del usuario.
 *
 * Claude busca y lee; el código (`validarCandidato` en `web.ts`) revisa cada dato antes de que se
 * pueda guardar: nunca se confía en el modelo para un correo o un teléfono.
 */

const REGLAS_DE_DATOS = `Reglas sobre los datos (son obligatorias):
- Sólo datos de contacto comerciales o profesionales que el propio negocio, institución o profesional publicó PARA SER CONTACTADO: su sitio web, su perfil de Instagram o Facebook, su correo, su teléfono o WhatsApp de contacto.
- NUNCA inventes ni completes un dato "probable" (por ejemplo, armar un correo info@ con el dominio). Si un dato no está publicado, dejalo vacío (null).
- NUNCA uses datos personales que aparezcan en comentarios, reseñas, foros, listas filtradas o bases de datos de terceros, ni el teléfono o correo particular de una persona que no lo publicó para trabajar.
- Por cada dato poné en "fuenteUrl" la dirección EXACTA (http o https) de la página donde lo viste. Si no tenés esa dirección, no pongas el dato.
- Preferí siempre las páginas propias (su sitio, su perfil). Una página de terceros (un directorio, la lista de una federación o una asociación) sirve sólo si ahí está publicado el dato de contacto del negocio.
- No uses Google Maps ni fichas de Google como fuente de ningún dato.
- Son prospectos de Argentina: sólo negocios, instituciones o profesionales que trabajan en la provincia o ciudad que te pido.`;

const FORMATO_DATOS = `"datos": {
      "web": { "valor": "https://...", "fuenteUrl": "https://..." } o null,
      "instagram": { "valor": "https://www.instagram.com/usuario", "fuenteUrl": "https://..." } o null,
      "facebook": { "valor": "https://www.facebook.com/pagina", "fuenteUrl": "https://..." } o null,
      "email": { "valor": "correo@dominio", "fuenteUrl": "https://..." } o null,
      "telefono": { "valor": "número tal como está publicado", "fuenteUrl": "https://..." } o null,
      "whatsapp": { "valor": "número o enlace wa.me", "fuenteUrl": "https://..." } o null
    }`;

const FORMATO_DESCUBRIR = `Respondé SOLO con un bloque \`\`\`json con este objeto:
{
  "candidatos": [
    {
      "nombre": "nombre del negocio, institución o profesional",
      "ciudad": "ciudad donde trabaja, o null",
      ${FORMATO_DATOS}
    }
  ]
}
Si no encontraste ninguno con datos publicados, devolvé "candidatos": [].`;

const FORMATO_LUGAR = `Respondé SOLO con un bloque \`\`\`json con este objeto:
{
  "candidato": {
    "nombre": "nombre del negocio como lo publica en su sitio o perfil",
    ${FORMATO_DATOS}
  }
}
Si no encontraste su sitio ni su perfil, o no publica ningún dato de contacto, devolvé "candidato": null.`;

export const SISTEMA_DESCUBRIR = `Sos el Buscador de DNX, un grupo de plataformas de fotografía de Argentina (DNX Estudio, CompraMelaFoto, FOTOFFICE, Infospot). Buscás prospectos —fotógrafos, escuelas, clubes, organizadores, asociaciones y negocios vinculados a la fotografía— en una provincia argentina, para que el equipo de DNX los contacte después.

Cómo trabajar (con la búsqueda web, en español y en sitios de acá):
- Buscá negocios o profesionales del tipo que te pido en la provincia que te pido; si te paso un nicho, priorizalo.
- Por cada uno, buscá su sitio o su perfil y sacá de ahí los datos de contacto.
- Hasta 10 candidatos, los que tengan más datos publicados. No repitas el mismo negocio.

${REGLAS_DE_DATOS}

${FORMATO_DESCUBRIR}`;

export const SISTEMA_LEER_LUGAR = `Sos el Buscador de DNX, un grupo de plataformas de fotografía de Argentina. Te paso UN negocio o institución (nombre, ciudad y, si la hay, su web). Tu trabajo es encontrar su sitio o sus perfiles propios y sacar de ahí sus datos de contacto, para que el equipo de DNX lo contacte después.

Cómo trabajar (con la búsqueda web):
- Si te paso la web, buscá en ella (su página de contacto, el pie de página) los datos de contacto.
- Si no te paso la web, buscá su sitio o su perfil por el nombre y la ciudad. Asegurate de que sea el mismo negocio (mismo nombre y misma ciudad); si dudás, devolvé null.

${REGLAS_DE_DATOS}

${FORMATO_LUGAR}`;

function textoTipo(tipo: TipoContacto, nicho: string | null): string {
  const t = ETIQUETA_TIPO[tipo] ?? tipo;
  if (!nicho) return t;
  const n = nicho.startsWith("OTRO:") ? nicho.slice(5).trim() : (ETIQUETA_NICHO[nicho] ?? nicho);
  return `${t}, nicho: ${n}`;
}

export function pedidoDescubrir(t: { provincia: string; tipo: TipoContacto; nicho: string | null }): string {
  return `Buscá prospectos en la provincia de ${t.provincia} (Argentina).
Tipo: ${textoTipo(t.tipo, t.nicho)}.`;
}

export function pedidoLeerLugar(
  lugar: { nombre: string; web: string | null; direccion: string | null },
  t: { ciudad: string; provincia: string; tipo: TipoContacto; nicho: string | null },
): string {
  const lineas = [
    `Negocio: ${lugar.nombre}`,
    `Ciudad: ${t.ciudad}, provincia de ${t.provincia} (Argentina)`,
    lugar.direccion ? `Dirección: ${lugar.direccion}` : null,
    `Tipo: ${textoTipo(t.tipo, t.nicho)}`,
    lugar.web
      ? `Web: ${lugar.web}`
      : "No tiene web conocida: buscá su sitio o su perfil por el nombre y la ciudad.",
  ];
  return lineas.filter(Boolean).join("\n");
}
