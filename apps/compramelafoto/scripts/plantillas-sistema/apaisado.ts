/**
 * Libritos que se leen apaisados (como la «Plantilla San Patricio»).
 *
 * La hoja es la misma (30 × 20 cm, doblada al medio), pero todo lo de adentro va girado un cuarto
 * de vuelta: con el librito cerrado y girado, el doblez queda arriba y cada cara se lee como una
 * página apaisada de 20 × 15 cm; abierto, el interior se lee como un calendario (dos paneles
 * apaisados, uno arriba del otro).
 *
 * Convención (la misma de San Patricio, que el visor 3D endereza con `giroParaLeer`):
 * - Tapa (mitad derecha del exterior): todo a -90°.
 * - Contratapa (mitad izquierda del exterior): todo a +90°. Al dar vuelta el librito de costado
 *   queda derecha.
 * - Interior (la página entera): todo a -90°. El panel de arriba es la mitad izquierda.
 *
 * Cada cara se diseña en su propio sistema «de lectura» (x a la derecha, y hacia abajo, como se
 * la ve derecha) y `Panel` lo pasa al lienzo. En la tapa y la contratapa el doblez queda en el
 * borde de arriba (y = 0); en el interior, en el medio (y = PLIEGUE).
 */
import { ALTO, ANCHO, Armador, PLIEGUE, girarCon, type Estilo, type Rect, type RolFoto } from "./lienzo";

export type Cara = "tapa" | "contratapa" | "interior";

/** Ancho y alto de una cara leída derecha. */
export const LECTURA = {
  tapa: { w: ALTO, h: PLIEGUE },
  contratapa: { w: ALTO, h: PLIEGUE },
  interior: { w: ALTO, h: ANCHO },
} as const;

export class Panel {
  readonly w: number;
  readonly h: number;
  readonly giro: number;
  private readonly pagina: 0 | 1;
  private readonly ox: number;

  constructor(
    private readonly a: Armador,
    readonly cara: Cara,
  ) {
    this.w = LECTURA[cara].w;
    this.h = LECTURA[cara].h;
    this.pagina = cara === "interior" ? 1 : 0;
    this.giro = cara === "contratapa" ? 90 : -90;
    this.ox = cara === "tapa" ? PLIEGUE : 0;
  }

  /** El bloque del lienzo que, girado, ocupa `r` de la cara leída derecha. */
  bloque(r: Rect): Rect {
    const cu = r.x + r.w / 2;
    const cv = r.y + r.h / 2;
    const [cx, cy] = this.giro === -90 ? [this.ox + cv, ALTO - cu] : [this.ox + PLIEGUE - cv, cu];
    return { x: cx - r.w / 2, y: cy - r.h / 2, w: r.w, h: r.h };
  }

  private clave(c: string) {
    return this.cara === "contratapa" ? `ct_${c}` : this.cara === "tapa" ? `t_${c}` : c;
  }

  foto(rol: RolFoto, r: Rect, opts: { radio?: number; mascara?: "rect" | "circle"; giro?: number; clave?: string } = {}) {
    this.a.foto(this.pagina, rol, this.bloque(r), {
      ...opts,
      clave: this.clave(opts.clave ?? rol),
      giro: this.giro + (opts.giro ?? 0),
    });
  }

  texto(clave: string, nombre: string, r: Rect, contenido: string, e: Estilo, giro = 0) {
    this.a.texto(this.pagina, this.clave(clave), nombre, this.bloque(r), contenido, e, this.giro + giro);
  }

  variable(clave: string, nombre: string, r: Rect, variableKey: string, fallback: string, e: Estilo, giro = 0) {
    this.a.variable(this.pagina, this.clave(clave), nombre, this.bloque(r), variableKey, fallback, e, this.giro + giro);
  }

  listado(r: Rect, e: Estilo, columnas = 2) {
    this.a.listado(this.pagina, this.bloque(r), e, columnas, this.giro);
  }

  /** Logo del colegio, girado como la cara (entero en su recuadro). */
  logo(clave: string, r: Rect) {
    this.a.logo(this.pagina, this.clave(clave), this.bloque(r), this.giro);
  }

  forma(
    clave: string,
    nombre: string,
    r: Rect,
    o: { relleno: string; borde?: string; grosor?: number; radio?: number; opacidad?: number; giro?: number; circulo?: boolean },
  ) {
    this.a.forma(this.pagina, this.clave(clave), nombre, this.bloque(r), { ...o, giro: this.giro + (o.giro ?? 0) });
  }

  /** Una foto inclinada con su marco (y epígrafe), girando juntos como una polaroid. */
  polaroid(
    rol: RolFoto,
    marco: Rect,
    foto: Rect,
    grados: number,
    o: { relleno?: string; clave?: string; borde?: string } = {},
  ) {
    const c = o.clave ?? rol;
    this.forma(`marco_${c}`, `Marco ${c}`, marco, { relleno: o.relleno ?? "#ffffff", borde: o.borde, grosor: o.borde ? 3 : 0, giro: grados });
    this.foto(rol, girarCon(foto, marco, grados), { giro: grados, clave: o.clave });
  }

  /**
   * Dibuja en el fondo con las coordenadas de la cara leída derecha. Lo de la tapa y la
   * contratapa se recorta a su mitad, así nada pasa al otro lado del doblez.
   */
  svg(contenido: string): string {
    if (this.cara === "interior") {
      return `<g transform="matrix(0,-1,1,0,0,${ALTO})">${contenido}</g>`;
    }
    const m = this.giro === -90 ? `matrix(0,-1,1,0,0,${ALTO})` : `matrix(0,1,-1,0,${PLIEGUE},0)`;
    return `<svg x="${this.ox}" y="0" width="${PLIEGUE}" height="${ALTO}" overflow="hidden"><g transform="${m}">${contenido}</g></svg>`;
  }
}

/** Las tres caras de un librito apaisado. */
export function caras(a: Armador) {
  return { tapa: new Panel(a, "tapa"), contratapa: new Panel(a, "contratapa"), interior: new Panel(a, "interior") };
}

/** Para dibujar los fondos sin un `Armador` (los SVG se arman aparte de los bloques). */
export const panelDeFondo = (cara: Cara) => new Panel(new Armador(), cara);
