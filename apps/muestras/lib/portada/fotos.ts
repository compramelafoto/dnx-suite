/**
 * Las fotos del banner de la portada, en el orden en que pasan. Son archivos estáticos de
 * `public/portada/` (blanco y negro, 1783×1157). Para cambiarlas alcanza con tocar esta lista.
 *
 * Si la lista queda vacía la portada sigue funcionando: el banner queda sobre fondo tinta.
 */

export type FotoPortada = {
  /** Ruta pública, desde la raíz del sitio. */
  src: string;
  ancho: number;
  alto: number;
  /** Qué se ve en la foto. */
  alt: string;
  /** Para el crédito: "Fotografía: …". */
  autor: string;
};

const foto = (archivo: string, alt: string): FotoPortada => ({ src: `/portada/${archivo}`, ancho: 1783, alto: 1157, alt, autor: "Daniel Cuart" });

export const FOTOS_PORTADA: FotoPortada[] = [
  foto("rosario-82.webp", "Cúpula del teatro vista desde la platea, con los palcos en curva, en blanco y negro"),
  foto("rosario-76.webp", "Fachada de la Bolsa de Comercio con su cúpula, vista desde abajo, en blanco y negro"),
  foto("rosario-11.webp", "Puente atirantado sobre el río, visto desde lo alto, en blanco y negro"),
  foto("rosario-88.webp", "Torres de una iglesia de piedra recortadas contra el cielo, en blanco y negro"),
  foto("rosario-65.webp", "Edificio antiguo de fachada ornamentada en una esquina, en blanco y negro"),
  foto("rosario-68.webp", "Edificio de esquina con cúpula y balcones, entre autos en movimiento, en blanco y negro"),
  foto("rosario-61.webp", "Torres iluminadas junto al río, de noche, en blanco y negro"),
  foto("rosario-15.webp", "Esquina de un edificio histórico iluminado de noche, en blanco y negro"),
];
