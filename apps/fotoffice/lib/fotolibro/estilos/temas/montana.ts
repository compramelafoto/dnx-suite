import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import { azar, degradado, estrellas, filete, filtroAcuarela, fondoLiso, grano, manchaAcuarela, montanas, paginas, svg } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos de montaña: Patagonia, Bariloche, Norte argentino, trekking. Además de las piezas de
 * `dibujo.ts`, acá viven las propias (pinos, carpa y fogata, brújula, curvas de nivel, quebradas
 * de colores, perfil de altura, guarda de tejido andino), en milímetros y con azar de semilla fija.
 */

const n = (v: number) => Math.round(v * 100) / 100;

// ─── Piezas de montaña ────────────────────────────────────────────────────────────────────────

/** Pino de tres pisos con tronco. */
function pino(x: number, base: number, alto: number, color: string, tronco = color): string {
  let out = `<rect x="${n(x - alto * 0.03)}" y="${n(base - alto * 0.14)}" width="${n(alto * 0.06)}" height="${n(alto * 0.14)}" fill="${tronco}"/>`;
  for (let i = 0; i < 3; i++) {
    const arriba = base - alto + i * alto * 0.24;
    const abajo = arriba + alto * 0.42;
    const a = alto * (0.15 + i * 0.06);
    out += `<path d="M ${n(x)} ${n(arriba)} L ${n(x + a)} ${n(abajo)} L ${n(x - a)} ${n(abajo)} Z" fill="${color}"/>`;
  }
  return out;
}

/** Bosque: una fila de pinos de alturas distintas a lo ancho de un tramo. */
function bosque(x: number, w: number, base: number, alto: number, colores: string[], semilla: number, densidad = 1): string {
  const rnd = azar(semilla);
  const cant = Math.max(2, Math.round((w / (alto * 0.22)) * densidad));
  let out = "";
  for (let i = 0; i < cant; i++) {
    const px = x + (w * (i + 0.5)) / cant + (rnd() - 0.5) * alto * 0.08;
    out += pino(px, base, alto * (0.55 + rnd() * 0.45), colores[Math.floor(rnd() * colores.length)]!);
  }
  return out;
}

/** Carpa canadiense con la puerta abierta. */
function carpa(x: number, base: number, ancho: number, color: string, sombra: string, interior: string): string {
  const alto = ancho * 0.68;
  return `<path d="M ${n(x - ancho / 2)} ${n(base)} L ${n(x)} ${n(base - alto)} L ${n(x + ancho / 2)} ${n(base)} Z" fill="${color}"/><path d="M ${n(x)} ${n(base - alto)} L ${n(x + ancho / 2)} ${n(base)} L ${n(x + ancho * 0.12)} ${n(base)} Z" fill="${sombra}"/><path d="M ${n(x)} ${n(base - alto * 0.72)} L ${n(x + ancho * 0.12)} ${n(base)} L ${n(x - ancho * 0.12)} ${n(base)} Z" fill="${interior}"/><line x1="${n(x)}" y1="${n(base - alto)}" x2="${n(x)}" y2="${n(base - alto - ancho * 0.08)}" stroke="${color}" stroke-width="${n(ancho * 0.025)}" stroke-linecap="round"/>`;
}

/** Fogata: leños cruzados y llama de tres lenguas. */
function fogata(x: number, base: number, t: number, lenos: string, fuego: string, centro: string): string {
  return `<g transform="translate(${n(x)} ${n(base)})"><rect x="${n(-t * 0.5)}" y="${n(-t * 0.1)}" width="${n(t)}" height="${n(t * 0.1)}" rx="${n(t * 0.05)}" fill="${lenos}" transform="rotate(12)"/><rect x="${n(-t * 0.5)}" y="${n(-t * 0.1)}" width="${n(t)}" height="${n(t * 0.1)}" rx="${n(t * 0.05)}" fill="${lenos}" transform="rotate(-12)"/><path d="M 0 ${n(-t * 0.08)} C ${n(-t * 0.4)} ${n(-t * 0.2)} ${n(-t * 0.2)} ${n(-t * 0.6)} 0 ${n(-t * 0.85)} C ${n(t * 0.05)} ${n(-t * 0.6)} ${n(t * 0.35)} ${n(-t * 0.5)} ${n(t * 0.25)} ${n(-t * 0.3)} C ${n(t * 0.32)} ${n(-t * 0.2)} ${n(t * 0.2)} ${n(-t * 0.08)} 0 ${n(-t * 0.08)} Z" fill="${fuego}"/><path d="M 0 ${n(-t * 0.1)} C ${n(-t * 0.18)} ${n(-t * 0.2)} ${n(-t * 0.08)} ${n(-t * 0.4)} 0 ${n(-t * 0.5)} C ${n(t * 0.08)} ${n(-t * 0.38)} ${n(t * 0.16)} ${n(-t * 0.2)} 0 ${n(-t * 0.1)} Z" fill="${centro}"/></g>`;
}

/** Rosa de los vientos: anillos con marcas y estrella de ocho puntas. */
function brujula(cx: number, cy: number, r: number, color: string, acento: string, grosor = 0.3): string {
  let out = `<g transform="translate(${n(cx)} ${n(cy)})"><circle r="${n(r)}" fill="none" stroke="${color}" stroke-width="${n(grosor)}"/><circle r="${n(r * 0.9)}" fill="none" stroke="${color}" stroke-width="${n(grosor * 0.6)}"/>`;
  for (let i = 0; i < 64; i++) {
    const largo = i % 8 === 0 ? 0.14 : i % 2 === 0 ? 0.08 : 0.04;
    out += `<line x1="0" y1="${n(-r * 0.9)}" x2="0" y2="${n(-r * (0.9 - largo))}" stroke="${color}" stroke-width="${n(grosor * 0.6)}" transform="rotate(${n(i * 5.625)})"/>`;
  }
  // Puntas: media punta llena y media vacía, para que se lea el relieve.
  const punta = (largo: number, ancho: number, giro: number, lleno: string) =>
    `<g transform="rotate(${giro})"><path d="M 0 ${n(-largo)} L ${n(ancho)} 0 L 0 0 Z" fill="${lleno}"/><path d="M 0 ${n(-largo)} L ${n(-ancho)} 0 L 0 0 Z" fill="none" stroke="${lleno}" stroke-width="${n(grosor * 0.6)}" stroke-linejoin="round"/></g>`;
  for (let i = 0; i < 4; i++) out += punta(r * 0.5, r * 0.08, i * 90 + 45, color);
  for (let i = 0; i < 4; i++) out += punta(r * 0.8, r * 0.12, i * 90, i === 0 ? acento : color);
  return `${out}<circle r="${n(r * 0.05)}" fill="${color}"/></g>`;
}

/** Curvas de nivel: anillos irregulares anidados, como en un mapa topográfico. */
function curvasNivel(cx: number, cy: number, rMax: number, anillos: number, color: string, semilla: number, grosor = 0.3, opacidad = 1): string {
  const rnd = azar(semilla);
  const armonicos = [2, 3, 5].map((k) => ({ k, amp: 0.06 + rnd() * 0.1, fase: rnd() * Math.PI * 2 }));
  const pasos = 48;
  let out = `<g fill="none" stroke="${color}" stroke-width="${n(grosor)}" opacity="${opacidad}">`;
  for (let a = 1; a <= anillos; a++) {
    const r0 = (rMax * a) / anillos;
    const extra = rnd() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let i = 0; i < pasos; i++) {
      const t = (Math.PI * 2 * i) / pasos;
      let f = 1;
      for (const h of armonicos) f += h.amp * Math.sin(h.k * t + h.fase) * (0.6 + a / anillos);
      f += 0.03 * Math.sin(4 * t + extra);
      pts.push([cx + Math.cos(t) * r0 * f, cy + Math.sin(t) * r0 * f * 0.85]);
    }
    // Curva suave (Catmull-Rom pasada a Bézier).
    let d = `M ${n(pts[0]![0])} ${n(pts[0]![1])}`;
    for (let i = 0; i < pasos; i++) {
      const p0 = pts[(i - 1 + pasos) % pasos]!;
      const p1 = pts[i]!;
      const p2 = pts[(i + 1) % pasos]!;
      const p3 = pts[(i + 2) % pasos]!;
      d += ` C ${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
    }
    out += `<path d="${d} Z"${a % 5 === 0 ? ` stroke-width="${n(grosor * 2)}"` : ""}/>`;
  }
  return `${out}</g>`;
}

/** Quebrada de colores: franjas onduladas apiladas desde abajo (como el cerro de los Siete Colores). */
function quebrada(x: number, w: number, base: number, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  colores.forEach((c, i) => {
    const h = alto * (1 - i / colores.length);
    const pasos = 24;
    const f1 = 1.5 + rnd() * 1.5;
    const f2 = 3 + rnd() * 3;
    const fase = rnd() * 6;
    let d = `M ${n(x)} ${n(base)}`;
    for (let k = 0; k <= pasos; k++) {
      const t = k / pasos;
      const y = base - h * (0.82 + 0.12 * Math.sin(t * Math.PI * f1 + fase) + 0.06 * Math.sin(t * Math.PI * f2 + fase * 2));
      d += ` L ${n(x + w * t)} ${n(y)}`;
    }
    out += `<path d="${d} L ${n(x + w)} ${n(base)} Z" fill="${c}"/>`;
  });
  return out;
}

/** Cardón: el cactus del norte, con dos brazos. */
function cardon(x: number, base: number, alto: number, color: string): string {
  const a = alto * 0.12;
  const g = n(a);
  return `<g stroke="${color}" stroke-width="${g}" stroke-linecap="round" fill="none"><line x1="${n(x)}" y1="${n(base)}" x2="${n(x)}" y2="${n(base - alto + a / 2)}"/><path d="M ${n(x)} ${n(base - alto * 0.38)} H ${n(x - alto * 0.24)} V ${n(base - alto * 0.72)}"/><path d="M ${n(x)} ${n(base - alto * 0.5)} H ${n(x + alto * 0.22)} V ${n(base - alto * 0.86)}"/></g>`;
}

/** Perfil de altura de un trekking: la línea del recorrido con su sombra, puntos y bandera en la cumbre. */
function perfilAltura(x: number, w: number, base: number, alto: number, linea: string, relleno: string, semilla: number): string {
  const rnd = azar(semilla);
  const pasos = 40;
  const pts: [number, number][] = [];
  let cumbre = 0;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const forma = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.4;
    const y = base - alto * (0.12 + 0.8 * forma * (0.88 + rnd() * 0.12));
    pts.push([x + w * t, y]);
    if (y < pts[cumbre]![1]) cumbre = i;
  }
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${n(p[0])} ${n(p[1])}`).join(" ");
  const [cx, cy] = pts[cumbre]!;
  let out = `<path d="${d} L ${n(x + w)} ${n(base)} L ${n(x)} ${n(base)} Z" fill="${relleno}"/><path d="${d}" stroke="${linea}" stroke-width="${n(alto * 0.03)}" fill="none" stroke-linejoin="round"/>`;
  out += `<line x1="${n(x)}" y1="${n(base)}" x2="${n(x + w)}" y2="${n(base)}" stroke="${linea}" stroke-width="${n(alto * 0.015)}" stroke-dasharray="${n(alto * 0.05)} ${n(alto * 0.04)}"/>`;
  for (const i of [0, Math.round(cumbre / 2), Math.round((cumbre + pasos) / 2), pasos]) {
    const [px, py] = pts[i]!;
    out += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(alto * 0.045)}" fill="#ffffff" stroke="${linea}" stroke-width="${n(alto * 0.02)}"/>`;
  }
  out += `<line x1="${n(cx)}" y1="${n(cy)}" x2="${n(cx)}" y2="${n(cy - alto * 0.3)}" stroke="${linea}" stroke-width="${n(alto * 0.02)}"/><path d="M ${n(cx)} ${n(cy - alto * 0.3)} l ${n(alto * 0.16)} ${n(alto * 0.06)} l ${n(-alto * 0.16)} ${n(alto * 0.06)} Z" fill="${linea}"/>`;
  return out;
}

/** Guarda de tejido andino: franjas lisas, rombos y dientes, en una banda horizontal. */
function guardaTejido(x: number, y: number, w: number, h: number, colores: { fondo: string; a: string; b: string; c: string; d: string }): string {
  let out = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${colores.fondo}"/>`;
  const f = h / 10;
  out += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(f)}" fill="${colores.a}"/><rect x="${n(x)}" y="${n(y + h - f)}" width="${n(w)}" height="${n(f)}" fill="${colores.a}"/>`;
  out += `<rect x="${n(x)}" y="${n(y + f * 1.5)}" width="${n(w)}" height="${n(f * 0.6)}" fill="${colores.c}"/><rect x="${n(x)}" y="${n(y + h - f * 2.1)}" width="${n(w)}" height="${n(f * 0.6)}" fill="${colores.c}"/>`;
  // Rombos en el centro, con un rombo chico adentro.
  const rh = f * 5;
  const cy = y + h / 2;
  const cant = Math.max(2, Math.round(w / rh));
  const paso = w / cant;
  for (let i = 0; i < cant; i++) {
    const cx = x + paso * (i + 0.5);
    out += `<path d="M ${n(cx)} ${n(cy - rh / 2)} L ${n(cx + paso / 2)} ${n(cy)} L ${n(cx)} ${n(cy + rh / 2)} L ${n(cx - paso / 2)} ${n(cy)} Z" fill="${i % 2 ? colores.b : colores.d}"/>`;
    out += `<path d="M ${n(cx)} ${n(cy - rh / 5)} L ${n(cx + paso / 5)} ${n(cy)} L ${n(cx)} ${n(cy + rh / 5)} L ${n(cx - paso / 5)} ${n(cy)} Z" fill="${colores.fondo}"/>`;
    out += `<circle cx="${n(x + paso * i)}" cy="${n(cy)}" r="${n(f * 0.5)}" fill="${colores.c}"/>`;
  }
  return out;
}

/** Montaña en línea: triángulo con nieve en zigzag, para el estilo nórdico. */
function montanaLinea(x: number, base: number, ancho: number, alto: number, color: string, grosor: number): string {
  const cx = x + ancho / 2;
  const top = base - alto;
  const nieve = 0.32;
  const yn = top + alto * nieve;
  const xn = (ancho / 2) * nieve;
  return `<g fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round" stroke-linecap="round"><path d="M ${n(x)} ${n(base)} L ${n(cx)} ${n(top)} L ${n(x + ancho)} ${n(base)}"/><path d="M ${n(cx - xn)} ${n(yn)} L ${n(cx - xn * 0.5)} ${n(yn - alto * 0.06)} L ${n(cx)} ${n(yn + alto * 0.02)} L ${n(cx + xn * 0.5)} ${n(yn - alto * 0.06)} L ${n(cx + xn)} ${n(yn)}"/></g>`;
}

// ─── Ayudas ───────────────────────────────────────────────────────────────────────────────────

const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";
const esTitulo = (tipo: TipoPliego, lado: "izq" | "der") => (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");

/** Suma la zona del título a la que reserve el estilo para sus adornos. */
function conTitulo(extra: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => zonaClasica(extra(tipo, lado, m), posicion)(tipo, lado, m);
}

/** Lo que hay que sumar al margen para que la foto empiece `libre` mm después de un adorno de `tam` mm. */
const despeje = (tam: number, margen: number, libre = 4) => Math.max(0, tam + libre - margen);

/**
 * Lo que reserva abajo un paisaje de alto `alto`: en la página del título se recorta (el título ya
 * se lleva la parte de arriba) para que siempre quede lugar para una foto.
 */
const abajoPaisaje = (tipo: TipoPliego, lado: "izq" | "der", m: Medidas, alto: number, margen: number) => {
  const z = despeje(alto, margen, 3);
  return esTitulo(tipo, lado) ? Math.min(z, m.altoMm * 0.09) : z;
};

const ejemplos = (titulo: string, subtitulo: string, fecha: string, frase: string) => ({ titulo, subtitulo, fecha, frase });

// ─── Estilos ──────────────────────────────────────────────────────────────────────────────────

export const MONTANA: EstiloFotolibro[] = [
  {
    id: "montana-01-cordillera-acuarela",
    tema: "montana",
    nombre: "Cordillera en acuarela",
    descripcion: "Cerros en capas de azul y gris pintados en acuarela, con mucho cielo para las fotos.",
    papel: "#fbfaf7",
    margenMm: 14,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = s * (fuerte(tipo) ? 0.3 : 0.2);
      const g = grano("g", m, 0.05);
      let c = fondoLiso(total, "#fbfaf7");
      c += `<g filter="url(#a)" opacity="0.75">${montanas(total, alto, ["#b8c7d9", "#8ea6c2", "#5f7d9c"], tipo === "interior-alt" ? 19 : 7, Math.max(4, Math.round(m.anchoMm / (s * 0.45))))}</g>`;
      if (tipo === "apertura") c += manchaAcuarela(m.anchoMm * 0.25, m.altoMm * 0.15, s * 0.1, "#f2c9a0", "a", 5, 2);
      return svg(m, c + g.cuerpo, filtroAcuarela("a", 6) + g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      // Las capas más altas casi nunca llegan al máximo: alcanza con reservar el 70 %.
      return { abajo: abajoPaisaje(tipo, lado, m, s * (fuerte(tipo) ? 0.3 : 0.2) * 0.72, 14) };
    }),
    textos: textosClasicos({ titulo: "Satisfy", texto: "Lato", color: "#3d5a78", acento: "#5f7d9c", escalaTitulo: 0.11, ejemplos: ejemplos("Bariloche en familia", "Vacaciones de verano", "Enero 2026", "Las montañas nos llaman") }),
  },
  {
    id: "montana-02-topografico",
    tema: "montana",
    nombre: "Mapa topográfico",
    descripcion: "Curvas de nivel en verde oliva sobre papel natural, como una carta de montaña.",
    papel: "#efeadb",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.08);
      const R = s * (fuerte(tipo) ? 0.42 : 0.32);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#efeadb");
      c += curvasNivel(izq.x - R * 0.05, -R * 0.1, R, 11, "#6b7a4a", 3, 0.42, 1);
      c += curvasNivel(der.x + der.w + R * 0.05, der.h + R * 0.1, R, 11, "#6b7a4a", 8, 0.42, 1);
      if (tipo === "interior-alt") c += curvasNivel(der.x + der.w, -s * 0.02, s * 0.16, 5, "#b0703c", 12, 0.38, 1);
      if (tipo === "apertura") c += `<path d="M ${n(izq.x + R * 0.25)} ${n(R * 0.2)} l ${n(R * 0.05)} ${n(-R * 0.09)} l ${n(R * 0.05)} ${n(R * 0.09)} Z" fill="#b0703c"/>`;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const R = s * (fuerte(tipo) ? 0.42 : 0.32);
      const t = despeje(R * 0.62, 13, 0);
      const z: Partial<Zona> = lado === "izq" ? { arriba: t, exterior: t * 0.5 } : { abajo: t, exterior: t * 0.5 };
      if (tipo === "interior-alt" && lado === "der") z.arriba = despeje(s * 0.13, 13, 2);
      return z;
    }),
    textos: textosClasicos({ titulo: "Oswald", texto: "Work Sans", color: "#4a5536", acento: "#b0703c", escalaTitulo: 0.11, ejemplos: ejemplos("Camino al Fitz Roy", "El Chaltén · Santa Cruz", "Febrero 2026", "Cada curva, un recuerdo") }),
  },
  {
    id: "montana-03-bosque-patagonico",
    tema: "montana",
    nombre: "Bosque patagónico",
    descripcion: "Siluetas de pinos en verde profundo sobre crema, para los lagos del sur.",
    papel: "#f4efe3",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const alto = s * (fuerte(tipo) ? 0.3 : 0.22);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f4efe3");
      const verdes = ["#1f3d2b", "#2d5240", "#3e6b4f"];
      if (tipo === "interior-alt") {
        // Sólo dos bosquecitos en los extremos de afuera, más altos.
        c += bosque(izq.x, s * 0.26, m.altoMm, alto * 1.25, verdes, 4, 1.4);
        c += bosque(der.x + der.w - s * 0.26, s * 0.26, m.altoMm, alto * 1.25, verdes, 9, 1.4);
      } else {
        c += bosque(0, m.anchoMm, m.altoMm, alto * 0.65, ["#b7c4b0", "#a7b8a3"], 21, 1.3);
        c += bosque(0, m.anchoMm, m.altoMm, alto, verdes, tipo === "cierre" ? 33 : 5, 0.7);
      }
      if (tipo === "apertura") c += `<circle cx="${n(izq.x + izq.w / 2)}" cy="${n(izq.h * 0.17)}" r="${n(s * 0.05)}" fill="#d9a35b"/>`;
      c += `<rect x="0" y="${n(m.altoMm - s * 0.01)}" width="${n(m.anchoMm)}" height="${n(s * 0.01)}" fill="#1f3d2b"/>`;
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = s * (fuerte(tipo) ? 0.3 : 0.22);
      if (tipo === "interior-alt") return { exterior: despeje(s * 0.26, 13, 3), abajo: 1 };
      return { abajo: abajoPaisaje(tipo, lado, m, alto * 0.85, 13) };
    }),
    textos: textosClasicos({ titulo: "Playfair Display", texto: "Lato", color: "#1f3d2b", acento: "#a0683a", escalaTitulo: 0.1, ejemplos: ejemplos("Villa La Angostura", "Ruta de los Siete Lagos", "Enero 2026", "Volver al sur, siempre") }),
  },
  {
    id: "montana-04-quebrada-colores",
    tema: "montana",
    nombre: "Quebrada de colores",
    descripcion: "Franjas onduladas en terracota, ocre y violeta, con cardones: el Norte argentino.",
    papel: "#faf1e4",
    margenMm: 13,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const colores = ["#8e4a6b", "#c0603e", "#e09a52", "#9c7a54", "#d97a5a", "#e8c07a"];
      const alto = s * (fuerte(tipo) ? 0.28 : 0.19);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#faf1e4");
      if (tipo === "apertura") c += `<circle cx="${n(izq.x + izq.w / 2)}" cy="${n(izq.h * 0.17)}" r="${n(s * 0.055)}" fill="#e8a24a"/>`;
      if (tipo === "interior-alt") {
        c += quebrada(der.x, der.w, m.altoMm, alto * 1.15, colores, 13);
        c += `<rect x="${n(izq.x)}" y="${n(izq.h - s * 0.02)}" width="${n(izq.w)}" height="${n(s * 0.02)}" fill="#c0603e"/>`;
      } else c += quebrada(0, m.anchoMm, m.altoMm, alto, colores, tipo === "cierre" ? 21 : 4);
      const base = m.altoMm - alto * 0.82;
      if (tipo !== "interior-alt") {
        c += cardon(izq.x + s * 0.1, base + s * 0.01, s * 0.15, "#4f6b3a") + cardon(izq.x + s * 0.17, base + s * 0.015, s * 0.09, "#4f6b3a");
        c += cardon(der.x + der.w - s * 0.12, base + s * 0.01, s * 0.13, "#4f6b3a");
      } else c += cardon(der.x + der.w - s * 0.1, m.altoMm - alto * 1.15 * 0.82 + s * 0.01, s * 0.14, "#4f6b3a");
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = s * (fuerte(tipo) ? 0.28 : 0.19);
      if (tipo === "interior-alt") return lado === "der" ? { abajo: despeje(alto * 1.15 + s * 0.05, 13, 3) } : { abajo: despeje(s * 0.02, 13) };
      return { abajo: abajoPaisaje(tipo, lado, m, alto + s * 0.06, 13) };
    }),
    textos: textosClasicos({ titulo: "Amatic SC", texto: "Raleway", color: "#7a3b2e", acento: "#8e4a6b", escalaTitulo: 0.12, ejemplos: ejemplos("Humahuaca", "Purmamarca · Tilcara", "Julio 2026", "El norte se lleva en el alma") }),
  },
  {
    id: "montana-05-lago-espejo",
    tema: "montana",
    nombre: "Lago espejo",
    descripcion: "Cerros nevados que se reflejan en un lago azul: postal de Bariloche.",
    papel: "#f6f9fb",
    margenMm: 13,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const lago = s * (fuerte(tipo) ? 0.14 : 0.09);
      const altoM = s * (fuerte(tipo) ? 0.2 : 0.13);
      const yLago = m.altoMm - lago;
      const cielo = degradado("c", total, "#ffffff", "#e6eff5");
      const agua = degradado("w", { x: 0, y: yLago, w: m.anchoMm, h: lago }, "#6f9fc0", "#2f5f86");
      const picos = Math.max(5, Math.round(m.anchoMm / (s * 0.3)));
      const cerros = montanas({ x: 0, y: 0, w: m.anchoMm, h: yLago }, altoM, ["#9db4c8", "#6b879f", "#45627c"], tipo === "interior-alt" ? 15 : 6, picos);
      let c = cielo.cuerpo + cerros;
      // Nieve en las cumbres de la capa del fondo: la misma cordillera, recortada arriba.
      c += `<clipPath id="nv"><rect x="0" y="0" width="${n(m.anchoMm)}" height="${n(yLago - altoM * 0.78)}"/></clipPath><g clip-path="url(#nv)">${montanas({ x: 0, y: 0, w: m.anchoMm, h: yLago }, altoM, ["#ffffff"], tipo === "interior-alt" ? 15 : 6, picos)}</g>`;
      c += agua.cuerpo;
      c += `<g transform="translate(0 ${n(2 * yLago)}) scale(1 -1)" opacity="0.28">${cerros}</g>`;
      c += `<clipPath id="lg"><rect x="0" y="${n(yLago)}" width="${n(m.anchoMm)}" height="${n(lago)}"/></clipPath>`;
      const rnd = azar(3);
      for (let i = 0; i < Math.round(m.anchoMm / 25); i++) {
        const x = rnd() * m.anchoMm;
        const y = yLago + lago * (0.25 + rnd() * 0.65);
        c += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + s * (0.03 + rnd() * 0.05))}" y2="${n(y)}" stroke="#ffffff" stroke-width="${n(s * 0.003)}" opacity="0.6" clip-path="url(#lg)"/>`;
      }
      return svg(m, c, cielo.defs + agua.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const total = s * (fuerte(tipo) ? 0.14 + 0.2 * 0.8 : 0.09 + 0.13 * 0.8);
      return { abajo: abajoPaisaje(tipo, lado, m, total, 13) };
    }),
    textos: textosClasicos({ titulo: "Lora", texto: "Montserrat", color: "#2f5f86", acento: "#45627c", escalaTitulo: 0.1, ejemplos: ejemplos("Bariloche 2026", "Invierno junto al Nahuel Huapi", "Julio 2026", "Hay lugares que se quedan con uno") }),
  },
  {
    id: "montana-06-noche-de-carpa",
    tema: "montana",
    nombre: "Noche de carpa",
    descripcion: "Cielo estrellado azul noche, carpa y fogata: el libro del campamento.",
    papel: "#16223a",
    margenMm: 13,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const cielo = degradado("n", total, "#0e1729", "#24365a");
      const alto = s * (fuerte(tipo) ? 0.2 : 0.13);
      let c = cielo.cuerpo;
      c += estrellas(total, "#f3e3b5", Math.round((m.anchoMm * m.altoMm) / (fuerte(tipo) ? 700 : 1400)), tipo === "interior-alt" ? 12 : 5, s * 0.014);
      if (tipo === "apertura") c += `<circle cx="${n(izq.x + izq.w * 0.5)}" cy="${n(izq.h * 0.15)}" r="${n(s * 0.045)}" fill="#f3e3b5"/><circle cx="${n(izq.x + izq.w * 0.5 + s * 0.02)}" cy="${n(izq.h * 0.15 - s * 0.012)}" r="${n(s * 0.04)}" fill="#111c31"/>`;
      c += montanas({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, alto, ["#2b3f63", "#1a2945"], 9, Math.max(4, Math.round(m.anchoMm / (s * 0.4))));
      c += bosque(0, s * 0.22, m.altoMm, alto * 0.75, ["#0f192c"], 3, 1.2);
      c += bosque(m.anchoMm - s * 0.18, s * 0.18, m.altoMm, alto * 0.7, ["#0f192c"], 7, 1.2);
      const cx = tipo === "interior-alt" ? izq.x + izq.w * 0.7 : der.x + der.w * 0.72;
      c += carpa(cx, m.altoMm - s * 0.01, alto * 0.75, "#e0884a", "#b9652f", "#f6c46b");
      c += fogata(cx + alto * 0.6, m.altoMm - s * 0.012, alto * 0.32, "#6b4a2f", "#f08a3a", "#ffd56b");
      return svg(m, c, cielo.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      return { abajo: abajoPaisaje(tipo, lado, m, s * (fuerte(tipo) ? 0.2 : 0.13) * 0.85, 13) };
    }),
    textos: textosClasicos({ titulo: "Montserrat", texto: "Montserrat", color: "#f3e3b5", acento: "#e0884a", escalaTitulo: 0.08, ejemplos: ejemplos("Los Alerces", "Cinco noches de carpa", "Febrero 2026", "Fogón, guitarra y cielo") }),
  },
  {
    id: "montana-07-brujula-y-mapa",
    tema: "montana",
    nombre: "Brújula y mapa",
    descripcion: "Papel pergamino, rosa de los vientos y un sendero punteado: diario de expedición.",
    papel: "#f1e6cc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.14, 1.1);
      const pergamino = degradado("p", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f4ead3", "#e8d8b4", false);
      let c = pergamino.cuerpo;
      for (const p of [izq, der]) c += filete(p, s * 0.035, "#7a5c3a", 0.4) + filete(p, s * 0.045, "#7a5c3a", 0.2);
      const r = s * (fuerte(tipo) ? 0.11 : 0.085);
      const bx = der.x + der.w - s * 0.06 - r;
      const by = der.h - s * 0.06 - r;
      if (tipo !== "interior") c += brujula(bx, by, r, "#5a4128", "#a8432f", 0.35);
      if (tipo === "apertura") {
        // Sendero punteado sobre el título, hasta una cruz de destino.
        const x0 = izq.x + izq.w * 0.2;
        const y0 = izq.h * 0.17;
        c += `<path d="M ${n(x0)} ${n(y0)} C ${n(x0 + izq.w * 0.2)} ${n(y0 + izq.h * 0.12)} ${n(x0 + izq.w * 0.35)} ${n(y0 - izq.h * 0.05)} ${n(x0 + izq.w * 0.58)} ${n(y0 + izq.h * 0.1)}" stroke="#a8432f" stroke-width="0.5" fill="none" stroke-dasharray="1.6 1.4"/>`;
        const xf = x0 + izq.w * 0.58;
        const yf = y0 + izq.h * 0.1;
        c += `<path d="M ${n(xf - 2)} ${n(yf - 2)} l 4 4 M ${n(xf + 2)} ${n(yf - 2)} l -4 4" stroke="#a8432f" stroke-width="0.6"/>`;
      }
      if (tipo === "interior") c += brujula(izq.x + s * 0.06 + r * 0.8, s * 0.06 + r * 0.8, r * 0.8, "#5a4128", "#a8432f", 0.3);
      return svg(m, c + g.cuerpo, pergamino.defs + g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const r = s * (fuerte(tipo) ? 0.11 : 0.085);
      const marco = despeje(s * 0.045, 15, 3);
      const z: Partial<Zona> = { arriba: marco, abajo: marco, exterior: marco, interior: marco };
      if (tipo !== "interior" && lado === "der") z.exterior = despeje(s * 0.06 + 2 * r, 15, 3);
      if (tipo === "interior" && lado === "izq") z.exterior = despeje(s * 0.06 + 1.6 * r, 15, 3);
      return z;
    }),
    textos: textosClasicos({ titulo: "Libre Baskerville", texto: "Crimson Text", color: "#4a3520", acento: "#a8432f", escalaTitulo: 0.09, ejemplos: ejemplos("Travesía al Lanín", "Diario de expedición", "Marzo 2026", "No todos los que vagan están perdidos") }),
  },
  {
    id: "montana-08-nordico-lineal",
    tema: "montana",
    nombre: "Nórdico lineal",
    descripcion: "Montañas dibujadas con una sola línea negra sobre blanco: moderno y despojado.",
    papel: "#ffffff",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const gr = Math.max(0.35, s * 0.003);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffffff");
      const grupo = (x: number, k: number, dir: number, base = m.altoMm - 16 * 0.45) =>
        montanaLinea(x, base, s * 0.16 * k, s * 0.12 * k, "#1d1d1b", gr) +
        montanaLinea(x + dir * s * 0.09 * k, base, s * 0.12 * k, s * 0.075 * k, "#1d1d1b", gr) +
        `<line x1="${n(Math.min(x, x + dir * s * 0.12 * k) - s * 0.02)}" y1="${n(base)}" x2="${n(Math.max(x + s * 0.16 * k, x + dir * s * 0.09 * k + s * 0.12 * k) + s * 0.02)}" y2="${n(base)}" stroke="#1d1d1b" stroke-width="${n(gr)}"/>`;
      if (tipo === "apertura") {
        // En la apertura, las montañas son un emblema arriba del título.
        const k = 1.1;
        const base = izq.h * 0.25;
        c += grupo(izq.x + izq.w / 2 - s * 0.1 * k, k, 1, base);
        c += `<circle cx="${n(izq.x + izq.w / 2 + s * 0.13)}" cy="${n(base - s * 0.13)}" r="${n(s * 0.018)}" fill="none" stroke="#c4553b" stroke-width="${n(gr)}"/>`;
      } else if (tipo === "cierre") c += grupo(der.x + der.w / 2 - s * 0.08, 1, 1);
      else if (tipo === "interior") c += grupo(izq.x + 16, 0.9, 1);
      else c += grupo(der.x + der.w - 16 - s * 0.16 * 0.9, 0.9, -1);
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const k = tipo === "cierre" ? 1 : 0.9;
      const toca = (tipo === "cierre" && lado === "der") || (tipo === "interior" && lado === "izq") || (tipo === "interior-alt" && lado === "der");
      return toca ? { abajo: abajoPaisaje(tipo, lado, m, s * 0.12 * k - 16 * 0.55, 0) } : {};
    }),
    textos: textosClasicos({ titulo: "Bebas Neue", texto: "Inter", color: "#1d1d1b", acento: "#c4553b", escalaTitulo: 0.12, ejemplos: ejemplos("Patagonia", "Torres del Paine · El Chaltén", "Marzo 2026", "Más alto, más lejos") }),
  },
  {
    id: "montana-09-trekking-aventura",
    tema: "montana",
    nombre: "Trekking aventura",
    descripcion: "Naranja y negro con el perfil de altura del recorrido: para el que sube cerros.",
    papel: "#f7f5f0",
    margenMm: 12,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f7f5f0");
      const franja = s * 0.035;
      if (tipo === "apertura") {
        // Página de título en negro con el perfil de la subida en naranja.
        c += fondoLiso(izq, "#1c1c1c");
        c += perfilAltura(izq.x + izq.w * 0.15, izq.w * 0.7, izq.h * 0.25, izq.h * 0.15, "#ff6b1a", "#ff6b1a33", 4);
      } else if (tipo === "cierre") {
        c += fondoLiso({ x: der.x, y: 0, w: der.w, h: der.h * 0.3 }, "#1c1c1c");
        c += fondoLiso({ x: izq.x, y: izq.h - franja, w: izq.w, h: franja }, "#ff6b1a");
      } else {
        const h = s * (tipo === "interior" ? 0.1 : 0.08);
        const p = tipo === "interior" ? izq : der;
        c += perfilAltura(p.x + 12, p.w - 24, p.h - 12 * 0.35, h, "#1c1c1c", "#ff6b1a40", tipo === "interior" ? 9 : 17);
        const otra = tipo === "interior" ? der : izq;
        c += fondoLiso({ x: tipo === "interior" ? otra.x + otra.w - franja : otra.x, y: 0, w: franja, h: otra.h }, "#ff6b1a");
      }
      return svg(m, c);
    },
    zona: (tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const franja = despeje(s * 0.035, 12, 4);
      if (tipo === "apertura") return lado === "izq" ? { arriba: m.altoMm * 0.62 } : {};
      if (tipo === "cierre") return lado === "der" ? { arriba: m.altoMm * 0.3 } : { abajo: franja };
      const conPerfil = (tipo === "interior" && lado === "izq") || (tipo === "interior-alt" && lado === "der");
      return conPerfil ? { abajo: despeje(s * (tipo === "interior" ? 0.1 : 0.08) * 1.35, 12, 3) } : { exterior: franja };
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Anton",
        texto: "Roboto",
        color: tipo === "apertura" || tipo === "cierre" ? "#ffffff" : "#1c1c1c",
        acento: "#ff6b1a",
        escalaTitulo: 0.12,
        ejemplos: ejemplos("Cerro Champaquí", "2.790 metros · Córdoba", "Abril 2026", "La cumbre es la mitad del camino"),
      })(tipo, m),
  },
  {
    id: "montana-10-tejido-andino",
    tema: "montana",
    nombre: "Tejido andino",
    descripcion: "Guardas de tejido con rombos en fucsia, mostaza y verde, sobre crudo: color del Norte.",
    papel: "#f6f0e4",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const h = s * 0.075;
      const colores = { fondo: "#2c2a4a", a: "#d7263d", b: "#f4b942", c: "#f6f0e4", d: "#1b998b" };
      const otros = { fondo: "#d7263d", a: "#2c2a4a", b: "#f4b942", c: "#f6f0e4", d: "#e86a92" };
      const g = grano("g", m, 0.07);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f6f0e4");
      if (tipo === "apertura") {
        c += guardaTejido(0, m.altoMm - h, m.anchoMm, h, colores);
        c += guardaTejido(izq.x, 0, izq.w, h * 0.6, otros);
      } else if (tipo === "interior") c += guardaTejido(0, m.altoMm - h, m.anchoMm, h, colores);
      else if (tipo === "interior-alt") {
        c += guardaTejido(0, 0, m.anchoMm, h * 0.6, otros);
      } else {
        c += guardaTejido(izq.x, m.altoMm - h, izq.w, h, colores);
        c += guardaTejido(der.x, m.altoMm - h * 0.6, der.w, h * 0.6, otros);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const h = s * 0.075;
      if (tipo === "interior-alt") return { arriba: despeje(h * 0.6, 12) };
      if (tipo === "cierre" && lado === "der") return { abajo: despeje(h * 0.6, 12) };
      return { abajo: esTitulo(tipo, lado) ? Math.min(m.altoMm * 0.09, despeje(h, 12)) : despeje(h, 12) };
    }),
    textos: textosClasicos({ titulo: "Amatic SC", texto: "Nunito", color: "#2c2a4a", acento: "#d7263d", escalaTitulo: 0.13, ejemplos: ejemplos("Salta, la linda", "Cafayate · Cachi", "Agosto 2026", "El norte nos queda en el alma") }),
  },
];
