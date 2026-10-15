/**
 * Medidas y piezas comunes de los libritos de sistema.
 *
 * Un librito es una hoja apaisada de 30 × 20 cm a 300 dpi que se dobla al medio:
 * - Página 0 (exterior): mitad izquierda = contratapa, mitad derecha = tapa.
 * - Página 1 (interior): las dos mitades que se ven al abrirlo.
 *
 * Todas las medidas están en píxeles del lienzo (300 dpi → 11,81 px por milímetro).
 */

export const ANCHO = 3543;
export const ALTO = 2362;
export const DPI = 300;
export const PX_POR_MM = DPI / 25.4;
export const mm = (v: number) => Math.round(v * PX_POR_MM);

/** El pliegue, en el centro. */
export const PLIEGUE = ANCHO / 2;
/** Margen de seguridad contra el corte (5 mm). */
export const SEGURIDAD = mm(5);
/** Nada importante a menos de 10 mm del pliegue. */
export const TUBO_PLIEGUE = mm(10);

/** Centro horizontal de cada mitad. */
export const CENTRO_IZQ = PLIEGUE / 2;
export const CENTRO_DER = PLIEGUE + PLIEGUE / 2;

/** La variable del logo del colegio (catálogo escolar del diseñador). */
export const VARIABLE_LOGO = "branding.schoolLogoUrl";

export type Rect = { x: number; y: number; w: number; h: number };

export type TipoBloque = "IMAGE" | "TEXT" | "VARIABLE_TEXT" | "SHAPE";

/**
 * Las fotos que puede pedir un librito, cada una atada a su hueco con nombre (los reconoce
 * `CLIENT_PHOTO_ROLE_SLOTS` de `@repo/template-editor-core`). La familia las elige en este orden.
 */
export const FOTOS = {
  individual: { variableKey: "photo_individual", nombre: "Foto individual", rolMeta: "single" },
  grupal: { variableKey: "photo_group", nombre: "Foto grupal", rolMeta: "group" },
  maestra: { variableKey: "photo_teacher", nombre: "Foto con la maestra", rolMeta: "teacher" },
  amigos: { variableKey: "photo_friends", nombre: "Foto con amigos", rolMeta: "friends" },
  libre: { variableKey: "photo_extra", nombre: "Foto libre", rolMeta: "extra" },
} as const;

export type RolFoto = keyof typeof FOTOS;

export type Bloque = {
  /** Sufijo estable; el id final es `<idVersion>_<clave>`. */
  clave: string;
  pagina: 0 | 1;
  tipo: TipoBloque;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  configJson: Record<string, unknown>;
};

export type Estilo = {
  familia: string;
  tam: number;
  color: string;
  peso?: number;
  alinear?: "LEFT" | "CENTER" | "RIGHT";
  interlineado?: number;
  mayus?: "none" | "uppercase" | "capitalize" | "lowercase";
  italica?: boolean;
};

function tipografia(e: Estilo) {
  return {
    color: e.color,
    fontSize: e.tam,
    textAlign: e.alinear ?? "CENTER",
    underline: false,
    fontFamily: e.familia,
    fontItalic: e.italica === true,
    fontWeight: e.peso ?? 400,
    lineHeight: e.interlineado ?? 1.2,
    letterSpacing: 0,
    textTransform: e.mayus ?? "none",
  };
}

/** Arma los bloques de una plantilla con zIndex creciente en el orden en que se agregan. */
export class Armador {
  readonly bloques: Bloque[] = [];
  private z = 0;

  private push(b: Omit<Bloque, "zIndex" | "opacity" | "rotation" | "locked"> & {
    rotation?: number;
    opacity?: number;
    locked?: boolean;
  }) {
    if (this.bloques.some((o) => o.clave === b.clave)) throw new Error(`Clave repetida: ${b.clave}`);
    this.z += 1;
    this.bloques.push({
      rotation: 0,
      opacity: 1,
      locked: false,
      ...b,
      x: round(b.x),
      y: round(b.y),
      width: round(b.width),
      height: round(b.height),
      zIndex: this.z,
    });
  }

  /** Fondo de página entera: imagen fija bloqueada (como San Patricio). */
  fondo(pagina: 0 | 1, archivo: string) {
    this.push({
      clave: `p${pagina}_fondo`,
      pagina,
      tipo: "IMAGE",
      nombre: pagina === 0 ? "Fondo exterior" : "Fondo interior",
      x: 0,
      y: 0,
      width: ANCHO,
      height: ALTO,
      locked: true,
      configJson: {
        fit: "cover",
        src: urlFondo(archivo),
        source: { variableKey: "" },
        maskShape: "rect",
        photoMode: "free",
        borderRadius: 0,
      },
    });
  }

  /**
   * Hueco de foto del cliente. El rol dice qué foto le pide a la familia (ver `FOTOS`). La misma
   * foto puede ir en dos huecos (en la tapa y en el interior): el segundo lleva otra `clave`.
   */
  foto(
    pagina: 0 | 1,
    rol: RolFoto,
    r: Rect,
    opts: { radio?: number; mascara?: "rect" | "circle"; giro?: number; clave?: string } = {},
  ) {
    const { variableKey, nombre } = FOTOS[rol];
    this.push({
      clave: `p${pagina}_foto_${opts.clave ?? rol}`,
      pagina,
      tipo: "IMAGE",
      nombre,
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      rotation: opts.giro ?? 0,
      configJson: {
        fit: "cover",
        src: "",
        source: { variableKey },
        maskShape: opts.mascara ?? "rect",
        photoMode: "free",
        borderRadius: opts.radio ?? 0,
      },
    });
  }

  /**
   * Logo del colegio: imagen atada a `branding.schoolLogoUrl`, entera en su recuadro ("contain").
   * Si el colegio no tiene logo cargado, el bloque no se dibuja (ni en pantalla ni en el PDF):
   * el diseño tiene que verse bien también sin él.
   */
  logo(pagina: 0 | 1, clave: string, r: Rect) {
    this.push({
      clave: `p${pagina}_${clave}`,
      pagina,
      tipo: "IMAGE",
      nombre: "Logo del colegio",
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      configJson: {
        fit: "contain",
        src: "",
        source: { variableKey: VARIABLE_LOGO },
        maskShape: "rect",
        photoMode: "free",
        borderRadius: 0,
      },
    });
  }

  texto(pagina: 0 | 1, clave: string, nombre: string, r: Rect, contenido: string, e: Estilo, giro = 0) {
    this.push({
      clave: `p${pagina}_${clave}`,
      pagina,
      tipo: "TEXT",
      nombre,
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      rotation: giro,
      configJson: { content: contenido, ...tipografia(e) },
    });
  }

  variable(
    pagina: 0 | 1,
    clave: string,
    nombre: string,
    r: Rect,
    variableKey: string,
    fallback: string,
    e: Estilo,
    giro = 0,
  ) {
    this.push({
      clave: `p${pagina}_${clave}`,
      pagina,
      tipo: "VARIABLE_TEXT",
      nombre,
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      rotation: giro,
      configJson: { variableKey, fallback, ...tipografia(e) },
    });
  }

  /** «Listado del curso»: el bloque reparte los alumnos en columnas y achica si no entran. */
  listado(pagina: 0 | 1, r: Rect, e: Estilo, columnas = 2, giro = 0) {
    this.push({
      clave: `p${pagina}_listado`,
      pagina,
      tipo: "VARIABLE_TEXT",
      nombre: "Listado del curso",
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      rotation: giro,
      configJson: {
        variableKey: "course.studentList",
        fallback: "",
        classList: {
          sortBy: "lastName",
          columns: columnas,
          nameOrder: "firstLast",
          givenNames: "all",
          highlightOwner: true,
        },
        ...tipografia(e),
      },
    });
  }

  forma(
    pagina: 0 | 1,
    clave: string,
    nombre: string,
    r: Rect,
    o: { relleno: string; borde?: string; grosor?: number; radio?: number; opacidad?: number; giro?: number; circulo?: boolean },
  ) {
    this.push({
      clave: `p${pagina}_${clave}`,
      pagina,
      tipo: "SHAPE",
      nombre,
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      rotation: o.giro ?? 0,
      opacity: o.opacidad ?? 1,
      configJson: {
        variant: o.circulo ? "circle" : "rectangle",
        fill: o.relleno,
        stroke: o.borde ?? "transparent",
        strokeWidth: o.grosor ?? 0,
        radius: o.radio ?? 0,
      },
    });
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Marcador que reemplaza quien carga el SQL con la URL pública del bucket (sin barra final). */
export const R2_BASE = "{{R2_BASE}}";
/** Carpeta del bucket donde viven los fondos de sistema. */
export const CARPETA_R2 = "template-v2/sistema";
export const urlFondo = (archivo: string) => `${R2_BASE}/${CARPETA_R2}/${archivo}`;

/** Rectángulo centrado en `cx`. */
export const centrado = (cx: number, y: number, w: number, h: number): Rect => ({ x: cx - w / 2, y, w, h });

/**
 * Mueve `r` como si girara `grados` junto con `marco` alrededor del centro del marco. El editor
 * y la impresión giran cada bloque sobre su propio centro: para que una foto y su marco (o el
 * epígrafe de una polaroid) giren como una sola pieza, el centro de la foto se corre a donde
 * caería al girar el marco.
 */
export function girarCon(r: Rect, marco: Rect, grados: number): Rect {
  const a = (grados * Math.PI) / 180;
  const cx = marco.x + marco.w / 2;
  const cy = marco.y + marco.h / 2;
  const dx = r.x + r.w / 2 - cx;
  const dy = r.y + r.h / 2 - cy;
  const nx = cx + dx * Math.cos(a) - dy * Math.sin(a);
  const ny = cy + dx * Math.sin(a) + dy * Math.cos(a);
  return { x: nx - r.w / 2, y: ny - r.h / 2, w: r.w, h: r.h };
}

/** Un rectángulo agrandado `d` px por lado (para marcos detrás de las fotos). */
export const agrandar = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
