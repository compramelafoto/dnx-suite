import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  degradado,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  grano,
  hoja,
  manchaAcuarela,
  paginas,
  rosa,
  svg,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/*
 * Estilos de Primera Comunión y Confirmación: el cáliz y la hostia, el pan y el vino (espigas y
 * uvas), el vitral de la iglesia, la paloma y las lenguas de fuego del Espíritu Santo, el rosario.
 * Todo en SVG con medidas en milímetros, relativo a la página.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** El lado más corto de una página: la escala de todos los adornos. */
const lado = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);
const esTitulo = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";

/** zonaClasica, pero con la reserva de los adornos proporcional al tamaño de la página. */
function zonaRel(extra: (s: number) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, l: "izq" | "der", m: Medidas): Partial<Zona> => zonaClasica(extra(lado(m)), posicion)(tipo, l, m);
}

// ---------------------------------------------------------------------------------------------
// Piezas propias de la comunión
// ---------------------------------------------------------------------------------------------

/** Una paloma en vuelo, mirando a la derecha (o a la izquierda con `espejo`). `tam` es su ancho. */
function paloma(x: number, y: number, tam: number, color: string, o: { giro?: number; espejo?: boolean; ala?: string } = {}): string {
  const sx = o.espejo ? -tam : tam;
  const cuerpo =
    "M0.46 -0.06 L0.38 -0.08 C0.35 -0.14 0.26 -0.15 0.22 -0.1 C0.16 -0.03 0.08 0.02 -0.05 0.04 C-0.2 0.06 -0.32 0.04 -0.5 0.1 L-0.43 0.16 L-0.5 0.22 C-0.3 0.2 -0.15 0.2 0 0.17 C0.18 0.14 0.3 0.06 0.36 -0.02 Z";
  const alaAtras = "M0.1 0 C0.08 -0.22 0.02 -0.4 -0.12 -0.52 C-0.1 -0.36 -0.12 -0.18 -0.18 -0.08 C-0.08 -0.02 0.02 0.01 0.1 0 Z";
  const alaFrente = "M0.14 0.02 C0.04 -0.2 -0.08 -0.36 -0.34 -0.48 C-0.26 -0.34 -0.24 -0.2 -0.28 -0.1 C-0.14 -0.02 0 0.04 0.14 0.02 Z";
  return `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(o.giro ?? 0)}) scale(${r2(sx)} ${r2(tam)})"><path d="${alaAtras}" fill="${o.ala ?? color}" opacity="0.6"/><path d="${cuerpo}" fill="${color}"/><path d="${alaFrente}" fill="${o.ala ?? color}"/></g>`;
}

/** Cruz latina. Con `trazo` se dibuja con línea fina en vez de rellena. */
function cruz(x: number, y: number, alto: number, color: string, o: { grosor?: number; trazo?: boolean; opacidad?: number } = {}): string {
  const g = alto * (o.grosor ?? 0.11);
  const brazo = alto * 0.62;
  const yb = y - alto * 0.2;
  if (o.trazo) {
    return `<g stroke="${color}" stroke-width="${r2(g)}" stroke-linecap="round" opacity="${o.opacidad ?? 1}"><line x1="${r2(x)}" y1="${r2(y - alto / 2)}" x2="${r2(x)}" y2="${r2(y + alto / 2)}"/><line x1="${r2(x - brazo / 2)}" y1="${r2(yb)}" x2="${r2(x + brazo / 2)}" y2="${r2(yb)}"/></g>`;
  }
  return `<g fill="${color}" opacity="${o.opacidad ?? 1}"><rect x="${r2(x - g / 2)}" y="${r2(y - alto / 2)}" width="${r2(g)}" height="${r2(alto)}" rx="${r2(g * 0.2)}"/><rect x="${r2(x - brazo / 2)}" y="${r2(yb - g / 2)}" width="${r2(brazo)}" height="${r2(g)}" rx="${r2(g * 0.2)}"/></g>`;
}

/** Una nube de copitos redondos, con la base plana. */
function nube(x: number, y: number, ancho: number, color: string, opacidad = 1): string {
  const u = ancho;
  const bolas: [number, number, number][] = [
    [-0.32, -0.02, 0.17],
    [-0.12, -0.14, 0.24],
    [0.13, -0.1, 0.21],
    [0.33, -0.01, 0.15],
  ];
  return (
    `<g opacity="${opacidad}">` +
    bolas.map(([bx, by, br]) => `<circle cx="${r2(x + bx * u)}" cy="${r2(y + by * u)}" r="${r2(br * u)}" fill="${color}"/>`).join("") +
    `<rect x="${r2(x - 0.45 * u)}" y="${r2(y - 0.06 * u)}" width="${r2(0.9 * u)}" height="${r2(0.12 * u)}" rx="${r2(0.06 * u)}" fill="${color}"/></g>`
  );
}

/** Rayos de luz que salen de un punto: líneas entre dos radios, en un abanico (grados). */
function rayos(cx: number, cy: number, r0: number, r1: number, n: number, color: string, grosor: number, o: { desde?: number; hasta?: number; opacidad?: number } = {}): string {
  const desde = ((o.desde ?? 0) * Math.PI) / 180;
  const hasta = ((o.hasta ?? 360) * Math.PI) / 180;
  const completo = (o.hasta ?? 360) - (o.desde ?? 0) >= 360;
  let out = `<g stroke="${color}" stroke-width="${r2(grosor)}" stroke-linecap="round" opacity="${o.opacidad ?? 1}">`;
  for (let i = 0; i < n; i++) {
    const a = desde + ((hasta - desde) * i) / (completo ? n : Math.max(1, n - 1));
    const largo = i % 2 === 0 ? r1 : r0 + (r1 - r0) * 0.7;
    out += `<line x1="${r2(cx + Math.cos(a) * r0)}" y1="${r2(cy + Math.sin(a) * r0)}" x2="${r2(cx + Math.cos(a) * largo)}" y2="${r2(cy + Math.sin(a) * largo)}"/>`;
  }
  return `${out}</g>`;
}

/** El cáliz con la hostia arriba. `alto` es el del cáliz (la hostia queda encima). */
function caliz(x: number, y: number, alto: number, color: string, hostia: string): string {
  const copa =
    "M-0.3 -0.5 L0.3 -0.5 C0.3 -0.22 0.16 -0.06 0.045 -0.02 L0.045 0.08 C0.1 0.1 0.1 0.16 0.045 0.18 L0.045 0.32 C0.06 0.38 0.26 0.4 0.27 0.5 L-0.27 0.5 C-0.26 0.4 -0.06 0.38 -0.045 0.32 L-0.045 0.18 C-0.1 0.16 -0.1 0.1 -0.045 0.08 L-0.045 -0.02 C-0.16 -0.06 -0.3 -0.22 -0.3 -0.5 Z";
  const hy = y - alto * 0.62;
  const hr = alto * 0.19;
  return (
    `<path d="${copa}" fill="${color}" transform="translate(${r2(x)} ${r2(y)}) scale(${r2(alto)})"/>` +
    `<line x1="${r2(x - alto * 0.3)}" y1="${r2(y - alto * 0.44)}" x2="${r2(x + alto * 0.3)}" y2="${r2(y - alto * 0.44)}" stroke="${hostia}" stroke-width="${r2(alto * 0.02)}" opacity="0.6"/>` +
    `<circle cx="${r2(x)}" cy="${r2(hy)}" r="${r2(hr)}" fill="${hostia}" stroke="${color}" stroke-width="${r2(alto * 0.02)}"/>` +
    cruz(x, hy + hr * 0.12, hr * 1.1, color, { trazo: true, grosor: 0.07 })
  );
}

/** Espiga de trigo: tallo y granos de a pares, con barbas finas. */
function espiga(x: number, y: number, largo: number, angulo: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  const g = largo * 0.06;
  let out = `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(angulo)})"><line x1="0" y1="0" x2="${r2(largo)}" y2="0" stroke="${color}" stroke-width="${r2(largo * 0.012)}" stroke-linecap="round"/>`;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const px = largo * (0.42 + (i / n) * 0.55);
    for (const s of [-1, 1]) {
      const a = s * (28 + rnd() * 8);
      out += `<ellipse cx="${r2(g * 0.8)}" cy="0" rx="${r2(g)}" ry="${r2(g * 0.42)}" fill="${color}" transform="translate(${r2(px)} 0) rotate(${r2(a)})"/>`;
      out += `<line x1="${r2(g * 1.6)}" y1="0" x2="${r2(g * 3.6)}" y2="0" stroke="${color}" stroke-width="${r2(largo * 0.004)}" transform="translate(${r2(px)} 0) rotate(${r2(a * 0.7)})" opacity="0.7"/>`;
    }
  }
  out += `<ellipse cx="${r2(largo + g * 0.7)}" cy="0" rx="${r2(g)}" ry="${r2(g * 0.4)}" fill="${color}"/>`;
  return `${out}</g>`;
}

/** Racimo de uvas colgando de (x, y), con dos hojas de vid. `tam` es el alto del racimo. */
function racimo(x: number, y: number, tam: number, color: string, brillo: string, hojaColor: string, espejo = false): string {
  const r = tam * 0.1;
  const filas = [4, 3, 3, 2, 1];
  let uvas = "";
  filas.forEach((cant, fila) => {
    for (let i = 0; i < cant; i++) {
      const ux = x + (i - (cant - 1) / 2) * r * 1.85;
      const uy = y + tam * 0.12 + fila * r * 1.65;
      uvas += `<circle cx="${r2(ux)}" cy="${r2(uy)}" r="${r2(r)}" fill="${color}"/><circle cx="${r2(ux - r * 0.35)}" cy="${r2(uy - r * 0.35)}" r="${r2(r * 0.25)}" fill="${brillo}" opacity="0.55"/>`;
    }
  });
  const s = espejo ? -1 : 1;
  const tallo = `<path d="M ${r2(x)} ${r2(y + tam * 0.08)} q ${r2(s * tam * 0.04)} ${r2(-tam * 0.1)} ${r2(s * tam * 0.12)} ${r2(-tam * 0.14)}" stroke="${hojaColor}" stroke-width="${r2(tam * 0.025)}" fill="none" stroke-linecap="round"/>`;
  const hojas = hoja(x, y + tam * 0.04, tam * 0.42, espejo ? -160 : -20, hojaColor, 0.62) + hoja(x, y + tam * 0.06, tam * 0.34, espejo ? -110 : -70, hojaColor, 0.62, 0.8);
  return tallo + hojas + uvas;
}

/** Franja de vitral: vidrios triangulares de colores con el plomo oscuro entre ellos. */
function vitral(x: number, y: number, w: number, h: number, colores: string[], plomo: string, semilla: number): string {
  const rnd = azar(semilla);
  const cols = 2;
  const cw = w / cols;
  const filas = Math.max(3, Math.round(h / cw));
  const ch = h / filas;
  let out = "";
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const x0 = x + c * cw;
      const y0 = y + f * ch;
      const col1 = colores[Math.floor(rnd() * colores.length)]!;
      const col2 = colores[Math.floor(rnd() * colores.length)]!;
      const diag = (f + c) % 2 === 0;
      const t1 = diag ? `${r2(x0)},${r2(y0)} ${r2(x0 + cw)},${r2(y0)} ${r2(x0)},${r2(y0 + ch)}` : `${r2(x0)},${r2(y0)} ${r2(x0 + cw)},${r2(y0)} ${r2(x0 + cw)},${r2(y0 + ch)}`;
      const t2 = diag ? `${r2(x0 + cw)},${r2(y0)} ${r2(x0 + cw)},${r2(y0 + ch)} ${r2(x0)},${r2(y0 + ch)}` : `${r2(x0)},${r2(y0)} ${r2(x0 + cw)},${r2(y0 + ch)} ${r2(x0)},${r2(y0 + ch)}`;
      out += `<polygon points="${t1}" fill="${col1}" opacity="${r2(0.75 + rnd() * 0.25)}"/><polygon points="${t2}" fill="${col2}" opacity="${r2(0.75 + rnd() * 0.25)}"/>`;
    }
  }
  // Un círculo de luz en el medio, como un rosetón.
  const rr = cw * 0.8;
  out += `<circle cx="${r2(x + w / 2)}" cy="${r2(y + h / 2)}" r="${r2(rr)}" fill="#f6e7b5"/>` + cruz(x + w / 2, y + h / 2 + rr * 0.1, rr * 1.2, plomo, { trazo: true, grosor: 0.08 });
  // El plomo: líneas de la grilla, diagonales y el marco.
  let plomos = `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="none"/>`;
  for (let f = 1; f < filas; f++) plomos += `<line x1="${r2(x)}" y1="${r2(y + f * ch)}" x2="${r2(x + w)}" y2="${r2(y + f * ch)}"/>`;
  for (let c = 1; c < cols; c++) plomos += `<line x1="${r2(x + c * cw)}" y1="${r2(y)}" x2="${r2(x + c * cw)}" y2="${r2(y + h)}"/>`;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const x0 = x + c * cw;
      const y0 = y + f * ch;
      plomos += (f + c) % 2 === 0 ? `<line x1="${r2(x0 + cw)}" y1="${r2(y0)}" x2="${r2(x0)}" y2="${r2(y0 + ch)}"/>` : `<line x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x0 + cw)}" y2="${r2(y0 + ch)}"/>`;
    }
  }
  plomos += `<circle cx="${r2(x + w / 2)}" cy="${r2(y + h / 2)}" r="${r2(rr)}" fill="none"/>`;
  return `${out}<g stroke="${plomo}" stroke-width="${r2(cw * 0.06)}" stroke-linejoin="round">${plomos}</g>`;
}

/** Lengua de fuego del Espíritu Santo. `tam` es su alto. */
function llama(x: number, y: number, tam: number, color: string, centro: string, giro = 0): string {
  const forma = "M0 -1 C0.18 -0.6 0.62 -0.35 0.5 0.2 A0.5 0.5 0 0 1 -0.5 0.2 C-0.56 -0.1 -0.3 -0.2 -0.22 -0.45 C-0.12 -0.3 -0.05 -0.5 0 -1 Z";
  return `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(giro)}) scale(${r2(tam / 2)})"><path d="${forma}" fill="${color}"/><path d="${forma}" fill="${centro}" transform="translate(0 0.28) scale(0.5)"/></g>`;
}

/** Cuentas (rosario o collar de perlas) a lo largo de una curva cuadrática. */
function cuentas(p0: [number, number], c: [number, number], p1: [number, number], r: number, color: string, brillo: string, cadaCuanto = 0): string {
  const largo = Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p1[0] - c[0], p1[1] - c[1]);
  const n = Math.max(3, Math.floor(largo / (r * 2.6)));
  let out = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1];
    const rr = cadaCuanto && i % cadaCuanto === 0 ? r * 1.45 : r;
    out += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(rr)}" fill="${color}"/><circle cx="${r2(x - rr * 0.3)}" cy="${r2(y - rr * 0.32)}" r="${r2(rr * 0.32)}" fill="${brillo}" opacity="0.8"/>`;
  }
  return out;
}

/** Patrón de crucecitas en grilla, para las franjas modernas. */
function crucecitas(x: number, y: number, w: number, h: number, paso: number, color: string, grosor: number): string {
  let out = `<g stroke="${color}" stroke-width="${r2(grosor)}" stroke-linecap="round">`;
  const k = paso * 0.16;
  let fila = 0;
  for (let cy = y + paso / 2; cy < y + h; cy += paso, fila++) {
    for (let cx = x + paso / 2 + (fila % 2 ? paso / 2 : 0); cx < x + w - paso * 0.2; cx += paso) {
      out += `<line x1="${r2(cx - k)}" y1="${r2(cy)}" x2="${r2(cx + k)}" y2="${r2(cy)}"/><line x1="${r2(cx)}" y1="${r2(cy - k)}" x2="${r2(cx)}" y2="${r2(cy + k)}"/>`;
    }
  }
  return `${out}</g>`;
}

/**
 * Achica el cuerpo de un título si el ejemplo no entra en su caja (páginas angostas como la de
 * 20x30): estima el ancho con medio cuerpo por letra.
 */
function ajustarAlAncho(textos: NonNullable<EstiloFotolibro["textos"]>): NonNullable<EstiloFotolibro["textos"]> {
  return (tipo, m) =>
    textos(tipo, m).map((t) => {
      const ancho = t.ejemplo.length * 0.5 * ((t.puntos * 25.4) / 72) * (t.mayusculas ? 1.3 : 1);
      return ancho > t.w ? { ...t, puntos: (t.puntos * t.w) / ancho } : t;
    });
}

// ---------------------------------------------------------------------------------------------

const comunionNena = { titulo: "Valentina", subtitulo: "Mi Primera Comunión", fecha: "08 · 11 · 2026", frase: "Jesús vive en mi corazón" };
const comunionNene = { titulo: "Tomás", subtitulo: "Mi Primera Comunión", fecha: "08 · 11 · 2026", frase: "Hoy recibí a Jesús" };
const confirmacion = { titulo: "Joaquín", subtitulo: "Confirmación", fecha: "15 · 08 · 2026", frase: "Recibí el don del Espíritu Santo" };

const ESTILOS: EstiloFotolibro[] = [
  {
    id: "comunion-01-caliz-dorado",
    tema: "comunion",
    nombre: "Cáliz dorado",
    descripcion: "Blanco perla con el cáliz y la hostia radiante en dorado. El clásico que nunca falla.",
    papel: "#fffdf8",
    margenMm: 17,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const oro = "#c0a062";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffdf8");
      const sep = s * 0.04;
      for (const p of [izq, der]) c += filete(p, sep, oro, 0.45, s * 0.02) + filete(p, sep + s * 0.012, oro, 0.18, s * 0.014);
      if (tipo === "apertura") {
        const x = izq.x + izq.w / 2;
        const y = izq.h * 0.19;
        const a = Math.min(s * 0.12, izq.h * 0.11);
        c += rayos(x, y - a * 0.62, a * 0.28, a * 0.62, 24, oro, Math.max(0.2, s * 0.0016), { opacidad: 0.7 });
        c += caliz(x, y, a, oro, "#fffdf8");
      } else {
        // Abanicos de rayos en las esquinas de arriba, finitos.
        const k = s * (tipo === "cierre" ? 0.1 : 0.08);
        c += rayos(izq.x + sep, sep, k * 0.25, k, 7, oro, 0.25, { desde: 0, hasta: 90, opacidad: 0.7 });
        c += rayos(der.x + der.w - sep, sep, k * 0.25, k, 7, oro, 0.25, { desde: 90, hasta: 180, opacidad: 0.7 });
        if (tipo === "interior-alt") {
          c += rayos(izq.x + sep, izq.h - sep, k * 0.25, k, 7, oro, 0.25, { desde: 270, hasta: 360, opacidad: 0.7 });
          c += rayos(der.x + der.w - sep, der.h - sep, k * 0.25, k, 7, oro, 0.25, { desde: 180, hasta: 270, opacidad: 0.7 });
        }
        if (tipo === "cierre") c += cruz(der.x + der.w / 2, der.h - sep - s * 0.04, s * 0.04, oro);
      }
      return svg(m, c);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.05, abajo: s * 0.05, exterior: s * 0.03, interior: s * 0.01 })),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Playfair Display", color: "#8a6a2c", acento: "#a8894f", ejemplos: comunionNena, escalaTitulo: 0.12 }),
  },
  {
    id: "comunion-02-pan-y-vino",
    tema: "comunion",
    nombre: "Pan y vino",
    descripcion: "Espigas de trigo y racimos de uva sobre papel de lino. Cálido, natural y lleno de símbolo.",
    papel: "#f4eee2",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("c02g", m, 0.12, 1.1);
      const k = esTitulo(tipo) ? 1 : 0.75;
      const trigo = "#c49a4a";
      const uva = "#6d3b5e";
      const vid = "#7f8c5a";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f4eee2");
      // Ramo de esquina: tres espigas en abanico y un racimo.
      const ramo = (x: number, y: number, abajo: boolean, derecha: boolean, sem: number) => {
        const base = derecha ? (abajo ? 225 : 135) : abajo ? -45 : 45;
        const sx = derecha ? -1 : 1;
        let out = "";
        [-28, 0, 28].forEach((d, i) => (out += espiga(x, y, s * (0.4 - Math.abs(d) * 0.003) * k, base + d, trigo, sem + i)));
        out += racimo(x + sx * s * 0.17 * k, y + (abajo ? -s * 0.27 : s * 0.02) * k, s * 0.21 * k, uva, "#e3c6dc", vid, derecha);
        return out;
      };
      if (tipo === "interior-alt") {
        c += ramo(der.x + der.w, 0, false, true, 3) + ramo(izq.x, izq.h, true, false, 9);
      } else {
        c += ramo(izq.x, 0, false, false, 3) + ramo(der.x + der.w, der.h, true, true, 9);
      }
      if (tipo === "cierre") c += espiga(der.x + der.w * 0.5 - s * 0.01, der.h * 0.255, s * 0.08, 180, trigo, 31) + espiga(der.x + der.w * 0.5 + s * 0.01, der.h * 0.255, s * 0.08, 0, trigo, 33);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.12, abajo: s * 0.07, exterior: s * 0.13 })),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Lora", color: "#5a3a2a", acento: "#8a6a3a", ejemplos: comunionNene, escalaTitulo: 0.12 }),
  },
  {
    id: "comunion-03-vitral",
    tema: "comunion",
    nombre: "Vitral",
    descripcion: "Una franja de vitral de colores, como la luz que entra en la iglesia. Distinto y lleno de color.",
    papel: "#efebe5",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("c03g", m, 0.08);
      const colores = ["#2f5d8a", "#b23a48", "#e0a526", "#3f7f5f", "#7a4f9a", "#4f9bc4"];
      const plomo = "#3a3330";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#efebe5");
      const ancho = s * (esTitulo(tipo) ? 0.13 : 0.1);
      const mg = s * 0.04;
      const banda = (x: number, sem: number) => vitral(x, mg, ancho, m.altoMm - 2 * mg, colores, plomo, sem);
      const linea = (x: number) => `<line x1="${r2(x)}" y1="${r2(mg)}" x2="${r2(x)}" y2="${r2(m.altoMm - mg)}" stroke="#b9ab97" stroke-width="0.3"/>`;
      if (tipo === "apertura") c += banda(izq.x + mg, 4) + linea(izq.x + mg + ancho + s * 0.02);
      else if (tipo === "cierre") c += banda(der.x + der.w - mg - ancho, 8) + linea(der.x + der.w - mg - ancho - s * 0.02);
      else if (tipo === "interior") c += banda(der.x + der.w - mg - ancho, 12);
      else c += banda(izq.x + mg, 16);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const conVitral = (tipo === "apertura" && l === "izq") || (tipo === "cierre" && l === "der") || (tipo === "interior" && l === "der") || (tipo === "interior-alt" && l === "izq");
      const ancho = s * (esTitulo(tipo) ? 0.13 : 0.1);
      return zonaClasica({ exterior: conVitral ? ancho + s * 0.03 : 0 })(tipo, l, m);
    },
    textos: (tipo, m) => {
      // El título se corre hacia adentro para no pisar el vitral.
      const s = lado(m);
      const corrimiento = (s * 0.13 + s * 0.06) / 2;
      return textosClasicos({ titulo: "Libre Baskerville", texto: "Raleway", color: "#2f3e5a", acento: "#b23a48", ejemplos: comunionNena, escalaTitulo: 0.09 })(tipo, m).map((t) =>
        tipo === "apertura" ? { ...t, x: t.x + corrimiento, w: t.w - corrimiento } : tipo === "cierre" ? { ...t, w: t.w - corrimiento } : t,
      );
    },
  },
  {
    id: "comunion-04-espiritu-santo",
    tema: "comunion",
    nombre: "Espíritu Santo",
    descripcion: "Para Confirmación: la paloma radiante y las lenguas de fuego en granate y oro.",
    papel: "#fbf6ee",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const oro = "#c99a3e";
      const rojo = "#9e2a2b";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf6ee");
      const banda = s * 0.018;
      c += fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: banda }, rojo) + fondoLiso({ x: 0, y: banda + s * 0.006, w: m.anchoMm, h: s * 0.003 }, oro);
      c += fondoLiso({ x: 0, y: m.altoMm - banda, w: m.anchoMm, h: banda }, rojo) + fondoLiso({ x: 0, y: m.altoMm - banda - s * 0.009, w: m.anchoMm, h: s * 0.003 }, oro);
      if (tipo === "apertura") {
        const x = izq.x + izq.w / 2;
        const y = izq.h * 0.15;
        const t = Math.min(s * 0.16, izq.h * 0.14);
        c += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(t * 0.62)}" fill="url(#c04h)"/>`;
        c += rayos(x, y, t * 0.42, t * 0.85, 32, oro, Math.max(0.2, s * 0.0016), { opacidad: 0.8 });
        c += paloma(x, y, t * 0.75, "#b5852c", { giro: -12, ala: "#d1a54d" });
      } else if (tipo === "cierre") {
        c += paloma(der.x + der.w / 2, der.h * 0.06 + s * 0.02, s * 0.06, oro);
      } else {
        const p = tipo === "interior" ? der : izq;
        const x = tipo === "interior" ? p.x + p.w - s * 0.07 : p.x + s * 0.07;
        for (let i = 0; i < 3; i++) c += llama(x + (i - 1) * s * 0.04, p.h - s * 0.075 - (i === 1 ? s * 0.018 : 0), s * (i === 1 ? 0.065 : 0.05), rojo, "#e8a33d");
      }
      if (tipo === "apertura") {
        // Tres lenguas de fuego abajo, del lado de la foto.
        for (let i = 0; i < 3; i++) c += llama(der.x + der.w - s * 0.07 + (i - 1) * s * 0.04, der.h - s * 0.075 - (i === 1 ? s * 0.018 : 0), s * (i === 1 ? 0.065 : 0.05), rojo, "#e8a33d");
      }
      return svg(m, c, `<radialGradient id="c04h"><stop offset="0" stop-color="#f7d98c" stop-opacity="0.9"/><stop offset="1" stop-color="#f7d98c" stop-opacity="0"/></radialGradient>`);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const base = zonaClasica({ arriba: s * 0.03, abajo: s * 0.03 })(tipo, l, m);
      const conLlamas = (tipo === "interior" && l === "der") || (tipo === "interior-alt" && l === "izq") || (tipo === "apertura" && l === "der");
      return conLlamas ? { ...base, exterior: s * 0.11 } : base;
    },
    textos: textosClasicos({ titulo: "Alex Brush", texto: "Montserrat", color: "#7a1f22", acento: "#b0812f", ejemplos: confirmacion, escalaTitulo: 0.12 }),
  },
  {
    id: "comunion-05-acuarela-lila",
    tema: "comunion",
    nombre: "Acuarela lila",
    descripcion: "Lavados de acuarela lila y celeste con florcitas blancas. Suave y femenino.",
    papel: "#fbf9fc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("c05g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf9fc");
      // Un lavado continuo a lo largo del borde de arriba y otro abajo, más intensos en apertura y cierre.
      const rnd = azar(tipo === "interior-alt" ? 19 : 7);
      const k = esTitulo(tipo) ? 1 : 0.7;
      const paso = s * 0.22;
      let i = 0;
      for (let x = 0; x < m.anchoMm + paso; x += paso, i++) {
        c += manchaAcuarela(x, -s * 0.03, s * 0.13 * k * (0.8 + rnd() * 0.5), i % 2 ? "#c8b3e0" : "#b9d3ec", "c05a", 100 + i, 2);
        c += manchaAcuarela(x + paso / 2, m.altoMm + s * 0.03, s * 0.11 * k * (0.8 + rnd() * 0.5), i % 2 ? "#b9d3ec" : "#c8b3e0", "c05a", 200 + i, 2);
      }
      const ramito = (x: number, y: number, sem: number) => {
        const r = azar(sem);
        let out = "";
        for (let j = 0; j < 5; j++) out += hoja(x, y, s * 0.06, -30 + j * 40 + r() * 20, "#9fb39a", 0.4, 0.85);
        out += flor(x, y, s * 0.03, "#ffffff", "#e8c76a", 6, r() * 60) + flor(x + s * 0.04, y + s * 0.015, s * 0.022, "#d9c7ee", "#e8c76a", 5, r() * 60) + flor(x - s * 0.03, y + s * 0.03, s * 0.018, "#ffffff", "#e8c76a", 5);
        return out;
      };
      if (tipo === "apertura") {
        c += ramito(izq.x + s * 0.08, s * 0.06, 3) + ramito(der.x + der.w - s * 0.08, der.h - s * 0.07, 5);
        c += cruz(izq.x + izq.w / 2, izq.h * 0.2, s * 0.06, "#8f78ad", { trazo: true, grosor: 0.05 });
      } else if (tipo === "cierre") {
        c += ramito(der.x + der.w - s * 0.08, s * 0.06, 7);
      } else {
        c += ramito(tipo === "interior" ? izq.x + s * 0.08 : der.x + der.w - s * 0.08, s * 0.06, 11);
      }
      return svg(m, c + g.cuerpo, filtroAcuarela("c05a", 6) + g.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.08, abajo: s * 0.06, exterior: s * 0.03 })),
    textos: textosClasicos({ titulo: "Allura", texto: "Quicksand", color: "#6d558d", acento: "#8f78ad", ejemplos: comunionNena, escalaTitulo: 0.13 }),
  },
  {
    id: "comunion-06-azul-y-oro",
    tema: "comunion",
    nombre: "Azul y oro",
    descripcion: "Azul marino profundo con cruz y filetes dorados. Elegante y sobrio, ideal para varones.",
    papel: "#1d2b4a",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const oro = "#d4b26a";
      const fondo = degradado("c06f", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#1a2744", "#24355a");
      let c = fondo.cuerpo;
      const sep = s * 0.045;
      for (const p of [izq, der]) c += filete(p, sep, oro, 0.4);
      if (tipo === "apertura") {
        const a = Math.min(s * 0.13, izq.h * 0.12);
        c += rayos(izq.x + izq.w / 2, izq.h * 0.17, a * 0.45, a * 0.85, 16, oro, 0.25, { opacidad: 0.5 });
        c += cruz(izq.x + izq.w / 2, izq.h * 0.19, a, oro, { grosor: 0.09 });
      }
      // Espigas cruzadas en el centro del filete, chiquitas, con un corte en la línea.
      const espigas = (x: number, y: number, k: number, fondoColor: string) =>
        fondoLiso({ x: x - s * 0.13 * k, y: y - s * 0.02, w: s * 0.26 * k, h: s * 0.04 }, fondoColor) + espiga(x - s * 0.012, y, s * 0.11 * k, 180, oro, 3) + espiga(x + s * 0.012, y, s * 0.11 * k, 0, oro, 5) + cruz(x, y, s * 0.03 * k, oro);
      if (tipo === "interior") c += espigas(der.x + der.w / 2, der.h - sep, 1, "#23345a");
      else if (tipo === "interior-alt") c += espigas(izq.x + izq.w / 2, izq.h - sep, 1, "#23345a") + espigas(der.x + der.w / 2, sep, 1, "#1b2845");
      else if (tipo === "cierre") c += espigas(der.x + der.w / 2, der.h - sep, 1.2, "#23345a");
      return svg(m, c, fondo.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.05, abajo: s * 0.05, exterior: s * 0.03, interior: s * 0.01 })),
    textos: textosClasicos({ titulo: "Playfair Display", texto: "Montserrat", color: "#e6c98a", acento: "#c9b48a", ejemplos: comunionNene, escalaTitulo: 0.1 }),
  },
  {
    id: "comunion-07-rosas-y-perlas",
    tema: "comunion",
    nombre: "Rosas y perlas",
    descripcion: "Collar de perlas y rosas blancas sobre rosa empolvado. Romántico, como el vestido de comunión.",
    papel: "#f8ecec",
    margenMm: 15,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const fondo = degradado("c07f", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#faf0ef", "#f3e1e1");
      let c = fondo.cuerpo;
      const perla = "#fffaf5";
      const brillo = "#ffffff";
      const sombra = "#e2cfcf";
      const ramoRosas = (x: number, y: number, k: number, sx: number, sem: number) => {
        const r = azar(sem);
        let out = "";
        for (let j = 0; j < 6; j++) out += hoja(x, y, s * 0.12 * k, (sx > 0 ? 0 : 180) + (j - 2.5) * 32 + r() * 10, j % 2 ? "#9fae98" : "#b8c4b1", 0.45);
        out += rosa(x, y, s * 0.055 * k, "#ffffff", "#e3c3c3", 10) + rosa(x + sx * s * 0.075 * k, y + s * 0.025 * k, s * 0.04 * k, "#f3d2d3", "#d7a7aa", 60) + rosa(x + sx * s * 0.02 * k, y + s * 0.07 * k, s * 0.032 * k, "#ffffff", "#e3c3c3", 120);
        return out;
      };
      // Collar de perlas colgando de esquina a esquina de cada página con un ramito en cada punta.
      for (const [i, p] of [izq, der].entries()) {
        if (tipo === "interior" && i === 0) continue;
        if (tipo === "interior-alt" && i === 1) continue;
        const caida = s * (esTitulo(tipo) ? 0.07 : 0.05);
        const y0 = s * 0.035;
        const a: [number, number] = [p.x + s * 0.08, y0];
        const b: [number, number] = [p.x + p.w - s * 0.08, y0];
        c += `<g transform="translate(${r2(s * 0.002)} ${r2(s * 0.003)})">${cuentas(a, [p.x + p.w / 2, y0 + caida * 2], b, s * 0.007, sombra, sombra)}</g>`;
        c += cuentas(a, [p.x + p.w / 2, y0 + caida * 2], b, s * 0.007, perla, brillo);
        c += ramoRosas(a[0], a[1], esTitulo(tipo) ? 1 : 0.8, 1, 3 + i) + ramoRosas(b[0], b[1], esTitulo(tipo) ? 1 : 0.8, -1, 7 + i);
      }
      return svg(m, c, fondo.defs);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const conCollar = !(tipo === "interior" && l === "izq") && !(tipo === "interior-alt" && l === "der");
      return zonaClasica({ arriba: conCollar ? s * (esTitulo(tipo) ? 0.15 : 0.12) : 0 })(tipo, l, m);
    },
    textos: textosClasicos({ titulo: "Tangerine", texto: "Lora", color: "#8e5a62", acento: "#a97c82", ejemplos: { ...comunionNena, titulo: "Martina" }, escalaTitulo: 0.14 }),
  },
  {
    id: "comunion-08-rosario",
    tema: "comunion",
    nombre: "Rosario",
    descripcion: "Un rosario de cuentas celestes que cae desde la esquina con su cruz. Sencillo y devoto.",
    papel: "#eef2f6",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("c08g", m, 0.05);
      const azul = "#6f8db0";
      const plata = "#9aa5b1";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#eef2f6");
      // El rosario baja desde la esquina de arriba y la cruz queda colgando.
      const rosario = (x: number, sx: number, k: number) => {
        const r = s * 0.0075 * k;
        const fin: [number, number] = [x + sx * s * 0.07 * k, s * 0.2 * k];
        let out = cuentas([x + sx * s * 0.18 * k, -r], [x - sx * s * 0.04 * k, s * 0.03 * k], fin, r, azul, "#ffffff", 11);
        out += cuentas([x + sx * s * 0.34 * k, -r], [x + sx * s * 0.28 * k, s * 0.14 * k], fin, r, azul, "#ffffff", 11);
        out += `<line x1="${r2(fin[0])}" y1="${r2(fin[1])}" x2="${r2(fin[0])}" y2="${r2(fin[1] + s * 0.03 * k)}" stroke="${plata}" stroke-width="${r2(r * 0.4)}"/>`;
        out += `<circle cx="${r2(fin[0])}" cy="${r2(fin[1])}" r="${r2(r * 1.6)}" fill="${plata}"/>`;
        out += cruz(fin[0], fin[1] + s * 0.06 * k, s * 0.06 * k, plata, { grosor: 0.13 });
        return out;
      };
      if (tipo === "apertura") c += rosario(izq.x + s * 0.04, 1, 1.1);
      else if (tipo === "cierre") c += rosario(der.x + der.w - s * 0.04, -1, 0.9);
      else if (tipo === "interior") c += rosario(der.x + der.w - s * 0.03, -1, 0.75);
      else c += rosario(izq.x + s * 0.03, 1, 0.75);
      c += `<line x1="${r2(s * 0.05)}" y1="${r2(m.altoMm - s * 0.035)}" x2="${r2(m.anchoMm - s * 0.05)}" y2="${r2(m.altoMm - s * 0.035)}" stroke="${plata}" stroke-width="0.3"/>`;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const conRosario = (tipo === "apertura" && l === "izq") || (tipo === "cierre" && l === "der") || (tipo === "interior" && l === "der") || (tipo === "interior-alt" && l === "izq");
      const k = tipo === "apertura" ? 1.1 : tipo === "cierre" ? 0.9 : 0.75;
      return zonaClasica({ exterior: conRosario ? s * 0.1 * k : 0, abajo: s * 0.03 })(tipo, l, m);
    },
    textos: textosClasicos({ titulo: "Marck Script", texto: "Lato", color: "#3e5a7d", acento: "#6f8db0", ejemplos: comunionNene, escalaTitulo: 0.12 }),
  },
  {
    id: "comunion-09-moderno-mostaza",
    tema: "comunion",
    nombre: "Moderno mostaza",
    descripcion: "Bloques mostaza y verde con un patrón de crucecitas y letra moderna. Para chicos que quieren algo actual.",
    papel: "#fbfaf6",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const mostaza = "#e0ad45";
      const verde = "#3f5a4e";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbfaf6");
      if (tipo === "apertura") {
        c += fondoLiso({ x: izq.x, y: 0, w: izq.w, h: izq.h }, verde);
        c += crucecitas(izq.x, izq.h * 0.66, izq.w, izq.h * 0.34, s * 0.06, "#5c7a6c", Math.max(0.3, s * 0.003));
        c += fondoLiso({ x: izq.x + izq.w * 0.44, y: izq.h * 0.2, w: izq.w * 0.12, h: s * 0.008 }, mostaza);
      } else if (tipo === "interior") {
        c += fondoLiso({ x: izq.x, y: izq.h - s * 0.05, w: m.anchoMm, h: s * 0.05 }, mostaza);
      } else if (tipo === "interior-alt") {
        c += fondoLiso({ x: der.x + der.w * 0.84, y: 0, w: der.w * 0.16, h: der.h }, mostaza);
        c += crucecitas(der.x + der.w * 0.84, 0, der.w * 0.16, der.h, der.w * 0.08, "#fbfaf6", Math.max(0.3, s * 0.003));
      } else {
        c += fondoLiso({ x: der.x, y: 0, w: der.w, h: der.h * 0.28 }, mostaza);
        c += crucecitas(izq.x, izq.h - s * 0.05, izq.w, s * 0.05, s * 0.05, mostaza, Math.max(0.3, s * 0.003));
      }
      return svg(m, c);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      if (tipo === "interior") return { abajo: s * 0.05 };
      if (tipo === "interior-alt" && l === "der") return { exterior: (m.anchoMm / 2) * 0.16 };
      if (tipo === "cierre" && l === "izq") return { abajo: s * 0.05 };
      return zonaClasica()(tipo, l, m);
    },
    textos: (tipo, m) =>
      textosClasicos({ titulo: "Bebas Neue", texto: "Poppins", color: tipo === "apertura" ? "#fbfaf6" : "#2f4339", acento: tipo === "apertura" ? "#e0ad45" : "#3f5a4e", ejemplos: comunionNene, escalaTitulo: 0.12 })(tipo, m),
  },
  {
    id: "comunion-10-gloria",
    tema: "comunion",
    nombre: "Gloria",
    descripcion: "Rayos de luz que bajan del cielo entre nubes, del celeste al crema. Luminoso y espiritual.",
    papel: "#f5f3ea",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const fondo = degradado("c10f", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#cfe2f1", "#f4ecdb");
      let c = fondo.cuerpo;
      // Haces de luz: triángulos blancos muy suaves desde arriba de cada página.
      const haces = (p: { x: number; w: number; h: number }, n: number, sem: number) => {
        const r = azar(sem);
        let out = "";
        const cx = p.x + p.w / 2;
        for (let i = 0; i < n; i++) {
          const a = -0.9 + (1.8 * i) / (n - 1) + (r() - 0.5) * 0.1;
          const ancho = 0.05 + r() * 0.05;
          const L = p.h * 1.6;
          out += `<polygon points="${r2(cx)},${r2(-s * 0.05)} ${r2(cx + Math.sin(a - ancho) * L)},${r2(Math.cos(a - ancho) * L)} ${r2(cx + Math.sin(a + ancho) * L)},${r2(Math.cos(a + ancho) * L)}" fill="#ffffff" opacity="0.28"/>`;
        }
        return out;
      };
      const n = esTitulo(tipo) ? 9 : 7;
      c += `<g clip-path="url(#c10i)">${haces(izq, n, tipo === "interior-alt" ? 5 : 3)}</g><g clip-path="url(#c10d)">${haces(der, n, 9)}</g>`;
      const sombra = (x: number, dir: number, k: number) => nube(x, m.altoMm - s * 0.006, s * 0.3 * k, "#e3d9c4", 0.7) + nube(x + dir * s * 0.2 * k, m.altoMm + s * 0.009, s * 0.24 * k, "#e3d9c4", 0.7);
      const nubes = (x: number, dir: number, k: number) => sombra(x, dir, k) + nube(x, m.altoMm - s * 0.01, s * 0.3 * k, "#ffffff", 0.95) + nube(x + dir * s * 0.2 * k, m.altoMm + s * 0.005, s * 0.24 * k, "#ffffff", 0.9);
      if (tipo === "apertura") {
        c += paloma(izq.x + izq.w / 2, izq.h * 0.17, s * 0.13, "#7fa4c4", { giro: -10, ala: "#a3c0d8" });
        c += nubes(izq.x + s * 0.06, 1, 1) + nubes(der.x + der.w - s * 0.06, -1, 1);
      } else if (tipo === "cierre") {
        c += nubes(izq.x + s * 0.06, 1, 1) + nubes(der.x + der.w - s * 0.06, -1, 1);
      } else {
        c += tipo === "interior" ? nubes(der.x + der.w - s * 0.05, -1, 0.8) : nubes(izq.x + s * 0.05, 1, 0.8);
      }
      const clips = `<clipPath id="c10i"><rect x="${r2(izq.x)}" y="0" width="${r2(izq.w)}" height="${r2(izq.h)}"/></clipPath><clipPath id="c10d"><rect x="${r2(der.x)}" y="0" width="${r2(der.w)}" height="${r2(der.h)}"/></clipPath>`;
      return svg(m, c, fondo.defs + clips);
    },
    zona: zonaRel((s) => ({ abajo: s * 0.08 })),
    textos: textosClasicos({ titulo: "Sacramento", texto: "Merriweather", color: "#3d5a78", acento: "#a8894f", ejemplos: { ...comunionNena, titulo: "Sofía" }, escalaTitulo: 0.13 }),
  },
];

export const COMUNION: EstiloFotolibro[] = ESTILOS.map((e) => (e.textos ? { ...e, textos: ajustarAlAncho(e.textos) } : e));
