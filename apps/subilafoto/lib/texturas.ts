/**
 * La textura de fondo de un evento.
 *
 * Dibujos chicos que se repiten detrás de todo: estrellas, globos, confeti. Dan carácter
 * sin competir con las fotos, que son las protagonistas.
 *
 * **Van en SVG embebido y no en archivos.** Un PNG en el bucket sería otra descarga en el
 * televisor del salón y otra cosa que puede fallar a las once de la noche; esto viaja con
 * la página y pesa unos cientos de bytes.
 *
 * La lista es cerrada por seguridad: el valor termina dentro de un atributo `style`, y si
 * entrara texto libre, un evento con los tokens manipulados podría inyectar CSS en la
 * pantalla del salón.
 */

export type ClaveDeTextura =
  | "ninguna"
  | "estrellas"
  | "globos"
  | "confeti"
  | "lunares"
  | "trama"
  | "destellos";

export type Textura = {
  clave: ClaveDeTextura;
  nombre: string;
  /** Cómo se ve, en la voz del fotógrafo que la elige. */
  descripcion: string;
};

export const TEXTURAS: Textura[] = [
  { clave: "ninguna", nombre: "Lisa", descripcion: "Sin dibujo. El color solo." },
  { clave: "estrellas", nombre: "Estrellas", descripcion: "Cielo de noche, chiquitas y espaciadas." },
  { clave: "globos", nombre: "Globos", descripcion: "Cumpleaños. Suben despacio por el fondo." },
  { clave: "confeti", nombre: "Confeti", descripcion: "Fiesta. Papelitos de colores al caer." },
  { clave: "lunares", nombre: "Lunares", descripcion: "Puntitos parejos. Alegre sin gritar." },
  { clave: "trama", nombre: "Trama fina", descripcion: "Líneas muy finas. Sobrio, casi un papel." },
  { clave: "destellos", nombre: "Destellos", descripcion: "Brillos sueltos, como luces lejanas." },
];

const CLAVES = new Set<string>(TEXTURAS.map((t) => t.clave));

/** Lo que no está en la lista, no existe. */
export function texturaValida(valor: unknown): ClaveDeTextura {
  return typeof valor === "string" && CLAVES.has(valor) ? (valor as ClaveDeTextura) : "ninguna";
}

/** Sólo colores hexadecimales. Igual que en `tema.ts`, y por el mismo motivo. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * El cuerpo de cada dibujo, en coordenadas de su baldosa.
 *
 * `%%C%%` se reemplaza por el color del acento, ya codificado. Las figuras van con poca
 * opacidad a propósito: tienen que leerse como textura y no como contenido.
 */
const DIBUJOS: Record<Exclude<ClaveDeTextura, "ninguna">, { lado: number; cuerpo: string }> = {
  estrellas: {
    lado: 90,
    cuerpo: `<path d='M20 8l2.1 4.6L27 14l-4.9 1.4L20 20l-2.1-4.6L13 14l4.9-1.4z' fill='%%C%%' opacity='.5'/>
      <path d='M68 52l1.5 3.3L73 56.5l-3.5 1-1.5 3.3-1.5-3.3-3.5-1 3.5-1.2z' fill='%%C%%' opacity='.38'/>
      <circle cx='52' cy='22' r='1.6' fill='%%C%%' opacity='.45'/>
      <circle cx='14' cy='66' r='1.2' fill='%%C%%' opacity='.35'/>`,
  },
  globos: {
    lado: 110,
    cuerpo: `<ellipse cx='28' cy='30' rx='11' ry='14' fill='%%C%%' opacity='.30'/>
      <path d='M28 44c0 8 4 10 4 18' stroke='%%C%%' stroke-width='1.2' fill='none' opacity='.22'/>
      <ellipse cx='78' cy='70' rx='9' ry='11.5' fill='%%C%%' opacity='.24'/>
      <path d='M78 81.5c0 7-3 9-3 15' stroke='%%C%%' stroke-width='1.1' fill='none' opacity='.18'/>`,
  },
  confeti: {
    lado: 80,
    cuerpo: `<rect x='12' y='10' width='7' height='3' rx='1.4' transform='rotate(28 12 10)' fill='%%C%%' opacity='.5'/>
      <rect x='56' y='26' width='6' height='2.6' rx='1.2' transform='rotate(-42 56 26)' fill='%%C%%' opacity='.4'/>
      <rect x='30' y='54' width='7' height='3' rx='1.4' transform='rotate(64 30 54)' fill='%%C%%' opacity='.45'/>
      <rect x='66' y='64' width='5.5' height='2.4' rx='1.2' transform='rotate(12 66 64)' fill='%%C%%' opacity='.33'/>`,
  },
  lunares: {
    lado: 44,
    cuerpo: `<circle cx='11' cy='11' r='2.6' fill='%%C%%' opacity='.30'/>
      <circle cx='33' cy='33' r='2.6' fill='%%C%%' opacity='.30'/>`,
  },
  trama: {
    lado: 14,
    cuerpo: `<path d='M0 14L14 0' stroke='%%C%%' stroke-width='.8' opacity='.16'/>
      <path d='M-3 3L3 -3M11 17L17 11' stroke='%%C%%' stroke-width='.8' opacity='.16'/>`,
  },
  destellos: {
    lado: 120,
    cuerpo: `<path d='M30 18v12M24 24h12' stroke='%%C%%' stroke-width='1.4' opacity='.40' stroke-linecap='round'/>
      <path d='M88 62v9M83.5 66.5h9' stroke='%%C%%' stroke-width='1.2' opacity='.30' stroke-linecap='round'/>
      <path d='M58 92v6M55 95h6' stroke='%%C%%' stroke-width='1' opacity='.24' stroke-linecap='round'/>`,
  },
};

export type DibujoDeTextura = {
  /** Listo para `backgroundImage`. */
  imagen: string;
  /** Listo para `backgroundSize`. */
  tamano: string;
};

/**
 * La textura lista para poner de fondo, o `null` si no hay ninguna.
 *
 * El `#` del color se codifica como `%23`: crudo cortaría la URL de datos y la textura
 * no se vería. Un acento que no sea un color hexadecimal se descarta en vez de entrar al
 * SVG, para que esta función no dependa de que la hayan llamado bien.
 */
export function dibujoDeTextura(
  clave: ClaveDeTextura,
  acento: string,
): DibujoDeTextura | null {
  if (clave === "ninguna") return null;

  const color = HEX.test(acento.trim()) ? acento.trim() : "#FFFFFF";
  const { lado, cuerpo } = DIBUJOS[clave];

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${lado}' height='${lado}' viewBox='0 0 ${lado} ${lado}'>` +
    cuerpo.replace(/%%C%%/g, encodeURIComponent(color)) +
    `</svg>`;

  // Los espacios y saltos de línea del SVG tienen que ir codificados o la URL se corta.
  return {
    imagen: `url("data:image/svg+xml,${svg.replace(/\s+/g, " ").replace(/[<>#"\s]/g, (c) => encodeURIComponent(c))}")`,
    tamano: `${lado}px ${lado}px`,
  };
}
