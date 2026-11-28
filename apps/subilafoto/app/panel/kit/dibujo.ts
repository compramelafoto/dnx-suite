import type { Paleta } from "@/lib/kit/colores";

/**
 * Dibuja las piezas del kit en un `<canvas>`.
 *
 * Se dibujan en el navegador del fotógrafo y no en el servidor por la tipografía: la de
 * la marca está guardada como woff2, que el navegador ya cargó para mostrar el panel y que
 * los generadores de imágenes del servidor no leen. Así no hay que sumar dependencias ni
 * servicios, y la vista previa y el archivo son literalmente la misma imagen.
 *
 * Las piezas son marca blanca: llevan el logo y el nombre del fotógrafo, nunca el nuestro.
 */

export type Pieza = {
  nombre: string;
  precio: string;
  /** Lo que se escribe debajo del QR, sin `https://`. */
  enlaceCorto: string;
  paleta: Paleta;
  logo: HTMLImageElement | null;
  qr: HTMLCanvasElement;
  /** La familia tipográfica ya resuelta, como la usa `ctx.font`. */
  fuente: string;
};

export type Formato = "historia" | "publicacion" | "cuadrada";

export const FORMATOS: Record<Formato, { ancho: number; alto: number; nombre: string; uso: string }> = {
  historia: { ancho: 1080, alto: 1920, nombre: "Historia", uso: "Historias de Instagram y estados de WhatsApp" },
  publicacion: { ancho: 1080, alto: 1350, nombre: "Publicación", uso: "Publicación del perfil de Instagram o Facebook" },
  cuadrada: { ancho: 1080, alto: 1080, nombre: "Cuadrada", uso: "Para mandar por WhatsApp" },
};

/** A4 a 200 puntos por pulgada: alcanza para imprimir sin que se note. */
export const FOLLETO = { ancho: 1654, alto: 2339 };

const OSCURO = "#1a0530";
const GRIS = "#4a3a5e";
const VIOLETA = "#5b1db8";

const PASOS = [
  ["Escanean el QR", "Desde su mesa, con la cámara del celular."],
  ["Suben sus fotos", "Sin instalar nada y sin registrarse."],
  ["Salen en la pantalla", "En vivo, mientras pasa la fiesta."],
] as const;

const PASOS_DEL_FOLLETO = [
  ["El código está en la mesa", "En los centros de mesa, en la entrada o en la misma pantalla. Se escanea con la cámara del celular."],
  ["Suben sus fotos", "Sin instalar ninguna aplicación y sin crearse una cuenta. Las que ya tienen o una en el momento."],
  ["Se revisan antes de salir", "Cada foto pasa por un control automático de contenido antes de aparecer."],
  ["Aparecen en la pantalla", "En vivo durante la fiesta. Y al otro día, todas juntas en el álbum del evento."],
] as const;

const INCLUYE = [
  "Código QR para las mesas, la entrada o la pantalla",
  "Proyección en vivo en la pantalla del salón",
  "Si no hay pantalla, las fotos se ven en el celular de cada invitado",
  "Álbum con todas las fotos durante 30 días",
] as const;

// ── Primitivas ────────────────────────────────────────────────────────────

function fuente(p: Pieza, peso: 400 | 500 | 800, tamano: number): string {
  return `${peso} ${tamano}px ${p.fuente}`;
}

/** Parte un texto en renglones que entren en `ancho`. */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/);
  const salida: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba;
    } else {
      salida.push(actual);
      actual = palabra;
    }
  }
  if (actual) salida.push(actual);
  return salida;
}

/** Escribe un párrafo y devuelve dónde termina. */
function parrafo(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  opciones: { font: string; color: string; interlineado: number; centrado?: boolean },
): number {
  ctx.font = opciones.font;
  ctx.fillStyle = opciones.color;
  ctx.textBaseline = "top";
  ctx.textAlign = opciones.centrado ? "center" : "left";
  const xx = opciones.centrado ? x + ancho / 2 : x;
  let yy = y;
  for (const r of renglones(ctx, texto, ancho)) {
    ctx.fillText(r, xx, yy);
    yy += opciones.interlineado;
  }
  ctx.textAlign = "left";
  return yy;
}

function rectanguloRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * El logo, o el nombre del estudio si no hay logo. Encaja en la caja sin deformarse.
 * Va sobre una placa blanca: un logo pensado para fondo claro desaparece sobre el color
 * del fotógrafo, y no podemos saber cómo es cada logo.
 */
function marca(ctx: CanvasRenderingContext2D, p: Pieza, x: number, y: number, ancho: number, alto: number, centrado: boolean): number {
  if (p.logo && p.logo.naturalWidth > 0) {
    const relleno = Math.round(alto * 0.18);
    const escala = Math.min((ancho - relleno * 2) / p.logo.naturalWidth, (alto - relleno * 2) / p.logo.naturalHeight);
    const w = p.logo.naturalWidth * escala;
    const h = p.logo.naturalHeight * escala;
    const cajaW = w + relleno * 2;
    const cajaX = centrado ? x + (ancho - cajaW) / 2 : x;
    rectanguloRedondeado(ctx, cajaX, y, cajaW, alto, Math.round(alto * 0.16), "#FFFFFF");
    ctx.drawImage(p.logo, cajaX + relleno, y + (alto - h) / 2, w, h);
    return y + alto;
  }
  return parrafo(ctx, p.nombre, x, y, ancho, {
    font: fuente(p, 800, Math.round(alto * 0.42)),
    color: p.paleta.tinta,
    interlineado: Math.round(alto * 0.5),
    centrado,
  });
}

/** Tarjeta blanca con el QR, la invitación a escanear, el precio y el enlace. */
function tarjetaQr(ctx: CanvasRenderingContext2D, p: Pieza, x: number, y: number, ancho: number, escala = 1): number {
  const relleno = Math.round(48 * escala);
  const lado = ancho - relleno * 2;
  const alto = relleno + lado + Math.round(230 * escala) + relleno;
  rectanguloRedondeado(ctx, x, y, ancho, alto, Math.round(40 * escala), "#FFFFFF");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.qr, x + relleno, y + relleno, lado, lado);
  ctx.imageSmoothingEnabled = true;
  let yy = y + relleno + lado + Math.round(24 * escala);
  yy = parrafo(ctx, "Escaneá y contratalo", x + relleno, yy, lado, {
    font: fuente(p, 800, Math.round(38 * escala)),
    color: OSCURO,
    interlineado: Math.round(48 * escala),
    centrado: true,
  });
  yy = parrafo(ctx, p.precio, x + relleno, yy + Math.round(4 * escala), lado, {
    font: fuente(p, 800, Math.round(66 * escala)),
    color: VIOLETA,
    interlineado: Math.round(78 * escala),
    centrado: true,
  });
  parrafo(ctx, p.enlaceCorto, x + relleno, yy + Math.round(6 * escala), lado, {
    font: fuente(p, 500, Math.round(26 * escala)),
    color: GRIS,
    interlineado: Math.round(34 * escala),
    centrado: true,
  });
  return y + alto;
}

function titulo(ctx: CanvasRenderingContext2D, p: Pieza, x: number, y: number, ancho: number, tamano: number, centrado: boolean): number {
  const opciones = { font: fuente(p, 800, tamano), interlineado: Math.round(tamano * 1.12), centrado };
  const yy = parrafo(ctx, "Las fotos de tus invitados,", x, y, ancho, { ...opciones, color: p.paleta.tinta });
  return parrafo(ctx, "en vivo en la pantalla", x, yy, ancho, { ...opciones, color: p.paleta.acento });
}

function pasos(ctx: CanvasRenderingContext2D, p: Pieza, x: number, y: number, ancho: number, tamano: number): number {
  let yy = y;
  PASOS.forEach(([t, d], i) => {
    ctx.font = fuente(p, 800, tamano * 1.25);
    ctx.fillStyle = p.paleta.acento;
    ctx.textBaseline = "top";
    ctx.fillText(String(i + 1), x, yy);
    const sangria = tamano * 1.6;
    const fin = parrafo(ctx, t, x + sangria, yy, ancho - sangria, {
      font: fuente(p, 800, tamano),
      color: p.paleta.tinta,
      interlineado: Math.round(tamano * 1.2),
    });
    yy = parrafo(ctx, d, x + sangria, fin + 4, ancho - sangria, {
      font: fuente(p, 400, Math.round(tamano * 0.78)),
      color: p.paleta.tinta,
      interlineado: Math.round(tamano * 1.05),
    }) + tamano * 0.9;
  });
  return yy;
}

// ── Piezas ────────────────────────────────────────────────────────────────

export function dibujarPlaca(ctx: CanvasRenderingContext2D, formato: Formato, p: Pieza): void {
  const { ancho, alto } = FORMATOS[formato];
  ctx.clearRect(0, 0, ancho, alto);
  ctx.fillStyle = p.paleta.fondo;
  ctx.fillRect(0, 0, ancho, alto);

  if (formato === "historia") {
    const m = 96;
    // Arriba queda lugar libre: Instagram tapa los primeros ~200 px con la barra.
    let y = marca(ctx, p, m, 200, ancho - m * 2, 150, true);
    y = titulo(ctx, p, m, y + 90, ancho - m * 2, 92, true);
    // Abajo también: los últimos ~150 px los tapa la caja de respuesta.
    const anchoTarjeta = 560;
    tarjetaQr(ctx, p, (ancho - anchoTarjeta) / 2, Math.max(y + 80, 960), anchoTarjeta);
    return;
  }

  const m = formato === "publicacion" ? 80 : 68;
  const alturaMarca = formato === "publicacion" ? 120 : 96;
  let y = marca(ctx, p, m, m, ancho - m * 2, alturaMarca, false);
  y = titulo(ctx, p, m, y + 56, ancho - m * 2, formato === "publicacion" ? 76 : 64, false);

  const anchoTarjeta = formato === "publicacion" ? 420 : 380;
  const escala = anchoTarjeta / 600;
  const xTarjeta = ancho - m - anchoTarjeta;
  const altoTarjeta = anchoTarjeta + Math.round(230 * escala);
  const yTarjeta = Math.max(y + 56, alto - m - altoTarjeta);
  tarjetaQr(ctx, p, xTarjeta, yTarjeta, anchoTarjeta, escala);
  pasos(ctx, p, m, yTarjeta + 10, xTarjeta - m - 40, formato === "publicacion" ? 40 : 34);
}

export function dibujarFolleto(ctx: CanvasRenderingContext2D, p: Pieza): void {
  const { ancho, alto } = FOLLETO;
  const m = 130;
  const util = ancho - m * 2;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, ancho, alto);

  /*
    El encabezado se mide antes de pintarlo: el título se parte en más o menos renglones
    según el ancho real de la letra, y un alto fijo lo dejaba cortado o con un hueco.
    Primero se dibuja en un lienzo auxiliar para saber dónde termina.
  */
  const medir = (c: CanvasRenderingContext2D) => {
    let yy = marca(c, p, m, 110, util, 150, false);
    yy = titulo(c, p, m, yy + 70, util, 80, false);
    return parrafo(c, "Tus invitados escanean un código, suben las fotos que sacan con el celular y aparecen en la pantalla del salón.", m, yy + 30, util, {
      font: fuente(p, 500, 36),
      color: p.paleta.tinta,
      interlineado: 52,
    });
  };
  const auxiliar = document.createElement("canvas").getContext("2d");
  const finEncabezado = (auxiliar ? medir(auxiliar) : 700) + 80;
  ctx.fillStyle = p.paleta.fondo;
  ctx.fillRect(0, 0, ancho, finEncabezado);
  medir(ctx);

  // Cómo funciona: cuatro pasos en dos columnas.
  let y = finEncabezado + 90;
  y = parrafo(ctx, "Cómo funciona", m, y, util, { font: fuente(p, 800, 54), color: OSCURO, interlineado: 66 }) + 30;
  const separacion = 80;
  const columna = (util - separacion) / 2;
  let inicioFila = y;
  let finFila = y;
  PASOS_DEL_FOLLETO.forEach(([t, d], i) => {
    if (i === 2) inicioFila = finFila + 40;
    const x = m + (i % 2) * (columna + separacion);
    ctx.font = fuente(p, 800, 56);
    ctx.fillStyle = VIOLETA;
    ctx.textBaseline = "top";
    ctx.fillText(String(i + 1).padStart(2, "0"), x, inicioFila);
    const fin = parrafo(ctx, t, x, inicioFila + 74, columna, { font: fuente(p, 800, 36), color: OSCURO, interlineado: 46 });
    const final = parrafo(ctx, d, x, fin + 6, columna, { font: fuente(p, 400, 29), color: GRIS, interlineado: 40 });
    finFila = Math.max(finFila, final);
  });

  // Abajo: qué incluye a la izquierda y el QR con el precio a la derecha.
  const yAbajo = finFila + 90;
  const anchoTarjeta = 380;
  const xTarjeta = ancho - m - anchoTarjeta;
  const anchoLista = xTarjeta - m - 70;
  y = parrafo(ctx, "Qué incluye", m, yAbajo, anchoLista, { font: fuente(p, 800, 44), color: OSCURO, interlineado: 54 }) + 26;
  for (const linea of INCLUYE) {
    ctx.fillStyle = VIOLETA;
    ctx.beginPath();
    ctx.arc(m + 10, y + 20, 9, 0, Math.PI * 2);
    ctx.fill();
    y = parrafo(ctx, linea, m + 40, y, anchoLista - 40, { font: fuente(p, 500, 29), color: OSCURO, interlineado: 40 }) + 16;
  }
  const escala = anchoTarjeta / 600;
  const altoTarjeta = anchoTarjeta + Math.round(230 * escala);
  rectanguloRedondeado(ctx, xTarjeta - 22, yAbajo - 22, anchoTarjeta + 44, altoTarjeta + 44, 44, p.paleta.fondo);
  tarjetaQr(ctx, p, xTarjeta, yAbajo, anchoTarjeta, escala);

  // Pie con el nombre del estudio: el folleto viaja solo, sin el mensaje que lo acompañó.
  parrafo(ctx, p.nombre, m, alto - 100, util, { font: fuente(p, 500, 28), color: GRIS, interlineado: 36 });
}
