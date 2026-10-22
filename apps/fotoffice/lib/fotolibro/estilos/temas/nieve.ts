import type { EstiloFotolibro, Medidas, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { azar, copo, degradado, estrellas, filete, filtroAcuarela, fondoLiso, grano, manchaAcuarela, paginas, svg, type Rect } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos de nieve: vacaciones de invierno en Bariloche, Chapelco, Las Leñas, Ushuaia… Copos,
 * pinos nevados, tejidos, chocolate caliente, pistas de esquí y la aurora austral.
 */

const f = (n: number) => Math.round(n * 100) / 100;
const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";
const total = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });

/** La zona clásica del título, más lo que reservan los adornos de cada página. */
function zonaCon(extra: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => {
    const base = zonaClasica({}, posicion)(tipo, lado, m);
    const e = extra(tipo, lado, m);
    return base.arriba === undefined ? e : { ...e, arriba: Math.max(base.arriba, e.arriba ?? 0) };
  };
}

/** Lo que tapa un adorno de `mm` desde el borde, descontado el margen del estilo. */
const menos = (mm: number, margen: number) => Math.max(0, mm - margen);

// ---------------------------------------------------------------------------------------------
// Piezas propias de la nieve
// ---------------------------------------------------------------------------------------------

/** Un pino nevado: tres pisos de ramas con su capa de nieve festoneada y el tronco. */
function pino(x: number, base: number, alto: number, verde: string, nieve: string, tronco = "#5b4636"): string {
  const ancho = alto * 0.58;
  let out = `<rect x="${f(x - alto * 0.035)}" y="${f(base - alto * 0.12)}" width="${f(alto * 0.07)}" height="${f(alto * 0.12)}" fill="${tronco}"/>`;
  const pisos = [
    { abajo: base - alto * 0.1, arriba: base - alto * 0.56, w: ancho },
    { abajo: base - alto * 0.36, arriba: base - alto * 0.8, w: ancho * 0.76 },
    { abajo: base - alto * 0.6, arriba: base - alto, w: ancho * 0.52 },
  ];
  for (const p of pisos) {
    const hw = p.w / 2;
    out += `<path d="M ${f(x)} ${f(p.arriba)} L ${f(x + hw)} ${f(p.abajo)} L ${f(x - hw)} ${f(p.abajo)} Z" fill="${verde}"/>`;
    // La nieve: un triángulo de la punta con el borde de abajo en ondas.
    const hT = p.abajo - p.arriba;
    const yc = p.arriba + hT * 0.45;
    const hc = hw * 0.45;
    const b = (2 * hc) / 4;
    let d = `M ${f(x)} ${f(p.arriba)} L ${f(x + hc)} ${f(yc)}`;
    for (let i = 0; i < 4; i++) d += ` q ${f(-b / 2)} ${f(hT * 0.12)} ${f(-b)} 0`;
    out += `<path d="${d} Z" fill="${nieve}"/>`;
  }
  return out;
}

/** Una fila de pinos de distintos tamaños, con una loma de nieve al pie. */
function bosque(r: Rect, alto: number, verdes: string[], nieve: string, semilla: number, loma: string): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  let out = "";
  verdes.forEach((verde, capa) => {
    const escala = 1 - (verdes.length - 1 - capa) * 0.28;
    const paso = alto * 0.42 * escala;
    for (let x = r.x + paso * (0.3 + rnd() * 0.4); x < r.x + r.w; x += paso * (0.7 + rnd() * 0.6)) {
      const a = alto * escala * (0.65 + rnd() * 0.35);
      out += pino(x, base - alto * 0.06 * (1 - capa * 0.3), a, verde, nieve);
    }
  });
  // La loma: una curva suave que tapa los troncos.
  const y0 = base - alto * 0.1;
  let d = `M ${f(r.x)} ${f(base)} L ${f(r.x)} ${f(y0)}`;
  const tramos = Math.max(2, Math.round(r.w / (alto * 1.4)));
  for (let i = 0; i < tramos; i++) d += ` q ${f(r.w / tramos / 2)} ${f(-alto * 0.06 * (0.5 + rnd()))} ${f(r.w / tramos)} 0`;
  return `${out}<path d="${d} L ${f(r.x + r.w)} ${f(base)} Z" fill="${loma}"/>`;
}

/** Nevada: copos y puntitos al azar dentro de un área. */
function nevada(area: Rect, color: string, cantidad: number, semilla: number, tam: number, opacidad = 1): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    const s = tam * (0.4 + rnd() * 0.9);
    out +=
      rnd() > 0.55
        ? copo(x, y, s, color, Math.max(0.2, s * 0.09), f(opacidad * (0.6 + rnd() * 0.4)))
        : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.16)}" fill="${color}" opacity="${f(opacidad * (0.5 + rnd() * 0.5))}"/>`;
  }
  return out;
}

/**
 * Guarda de tejido nórdico: una franja de color con el dibujo en puntos (como un pulóver o un
 * gorro de lana). El motivo se arma en una grilla de 9 filas.
 */
const MOTIVO_NORDICO = [
  "1111111111",
  "1010101010",
  "0000000000",
  "0000100000",
  "0001110001",
  "0011011000",
  "0001110001",
  "0000100000",
  "0000000000",
  "0101010101",
  "1111111111",
];
function guardaNordica(x: number, y: number, w: number, h: number, fondo: string, punto: string): string {
  const filas = MOTIVO_NORDICO.length;
  const c = h / filas;
  const cols = Math.max(1, Math.floor(w / c));
  const c2 = w / cols; // celdas apenas más anchas para que cierre justo
  let out = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fondo}"/>`;
  MOTIVO_NORDICO.forEach((fila, j) => {
    let corrida = -1;
    for (let i = 0; i <= cols; i++) {
      const on = i < cols && fila[i % fila.length] === "1";
      if (on && corrida < 0) corrida = i;
      if (!on && corrida >= 0) {
        out += `<rect x="${f(x + corrida * c2)}" y="${f(y + j * c)}" width="${f((i - corrida) * c2 + 0.05)}" height="${f(c + 0.05)}" fill="${punto}"/>`;
        corrida = -1;
      }
    }
  });
  return out;
}

/** Aurora austral: cintas de luz borrosas que ondulan por el cielo. */
function aurora(m: Medidas, alto: number, colores: string[], opacidad: number, semilla: number, filtro: string): string {
  const rnd = azar(semilla);
  return colores
    .map((c, i) => {
      const y = alto * (0.25 + i * 0.22);
      const w = m.anchoMm;
      const amp = alto * (0.25 + rnd() * 0.2);
      const d = `M ${f(-w * 0.05)} ${f(y + amp * 0.3)} C ${f(w * 0.2)} ${f(y - amp)} ${f(w * 0.35)} ${f(y + amp)} ${f(w * 0.52)} ${f(y)} S ${f(w * 0.85)} ${f(y - amp * 0.8)} ${f(w * 1.05)} ${f(y + amp * 0.2)}`;
      return `<path d="${d}" stroke="${c}" stroke-width="${f(alto * (0.22 - i * 0.04))}" fill="none" opacity="${f(opacidad * (1 - i * 0.2))}" filter="url(#${filtro})" stroke-linecap="round"/>`;
    })
    .join("");
}

/** Silueta de cordillera rellena (para recortar el cielo de noche). */
function siluetaCordillera(r: Rect, alto: number, color: string, semilla: number, picos: number): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  let d = `M ${f(r.x)} ${f(base)}`;
  for (let i = 0; i <= picos * 2; i++) {
    const x = r.x + (r.w * i) / (picos * 2);
    const y = base - alto * (i % 2 === 1 ? 0.7 + rnd() * 0.3 : 0.25 + rnd() * 0.25);
    d += ` L ${f(x)} ${f(y)}`;
  }
  return `<path d="${d} L ${f(r.x + r.w)} ${f(base)} Z" fill="${color}"/>`;
}

/** Cordillera de una sola línea fina, con la línea de nieve marcada en los picos. */
function lineaCordillera(r: Rect, alto: number, color: string, grosor: number, semilla: number, picos: number): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  const pts: [number, number][] = [];
  for (let i = 0; i <= picos * 2; i++) {
    const x = r.x + (r.w * i) / (picos * 2);
    const y = base - alto * (i % 2 === 1 ? 0.6 + rnd() * 0.4 : 0.15 + rnd() * 0.25);
    pts.push([x, y]);
  }
  let out = `<path d="M ${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L ")}" stroke="${color}" stroke-width="${f(grosor)}" fill="none" stroke-linejoin="round"/>`;
  // En cada pico, un trazo corto en zigzag que marca hasta dónde llega la nieve.
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [px, py] = pts[i]!;
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i + 1]!;
    const t = 0.32;
    const l: [number, number] = [px + (ax - px) * t, py + (ay - py) * t];
    const rr: [number, number] = [px + (bx - px) * t, py + (by - py) * t];
    const mx = (l[0] + rr[0]) / 2;
    out += `<path d="M ${f(l[0])} ${f(l[1])} L ${f((l[0] + mx) / 2)} ${f(l[1] - alto * 0.04)} L ${f(mx)} ${f((l[1] + rr[1]) / 2 + alto * 0.03)} L ${f((rr[0] + mx) / 2)} ${f(rr[1] - alto * 0.04)} L ${f(rr[0])} ${f(rr[1])}" stroke="${color}" stroke-width="${f(grosor * 0.7)}" fill="none" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Una taza de chocolate humeante sobre su plato. `tam` es el ancho de la taza. */
function taza(x: number, base: number, tam: number, color: string, chocolate: string, vapor: string): string {
  const h = tam * 0.8;
  const top = base - tam * 0.08 - h;
  let out = `<ellipse cx="${f(x)}" cy="${f(base - tam * 0.06)}" rx="${f(tam * 0.78)}" ry="${f(tam * 0.1)}" fill="${color}" opacity="0.85"/>`;
  out += `<path d="M ${f(x + tam * 0.45)} ${f(top + h * 0.22)} c ${f(tam * 0.32)} 0 ${f(tam * 0.32)} ${f(h * 0.5)} 0 ${f(h * 0.5)}" stroke="${color}" stroke-width="${f(tam * 0.09)}" fill="none"/>`;
  out += `<path d="M ${f(x - tam / 2)} ${f(top)} L ${f(x + tam / 2)} ${f(top)} L ${f(x + tam * 0.42)} ${f(top + h * 0.8)} Q ${f(x + tam * 0.38)} ${f(top + h)} ${f(x + tam * 0.2)} ${f(top + h)} L ${f(x - tam * 0.2)} ${f(top + h)} Q ${f(x - tam * 0.38)} ${f(top + h)} ${f(x - tam * 0.42)} ${f(top + h * 0.8)} Z" fill="${color}"/>`;
  out += `<ellipse cx="${f(x)}" cy="${f(top)}" rx="${f(tam / 2)}" ry="${f(tam * 0.09)}" fill="${chocolate}"/>`;
  // Dos malvaviscos y el vapor.
  out += `<rect x="${f(x - tam * 0.2)}" y="${f(top - tam * 0.09)}" width="${f(tam * 0.16)}" height="${f(tam * 0.12)}" rx="${f(tam * 0.03)}" fill="#fff6ee"/><rect x="${f(x + tam * 0.03)}" y="${f(top - tam * 0.06)}" width="${f(tam * 0.15)}" height="${f(tam * 0.1)}" rx="${f(tam * 0.03)}" fill="#f7d9dc"/>`;
  for (let i = -1; i <= 1; i++) {
    const vx = x + i * tam * 0.2;
    out += `<path d="M ${f(vx)} ${f(top - tam * 0.15)} c ${f(-tam * 0.12)} ${f(-tam * 0.15)} ${f(tam * 0.12)} ${f(-tam * 0.25)} 0 ${f(-tam * 0.42)} c ${f(-tam * 0.1)} ${f(-tam * 0.12)} ${f(tam * 0.08)} ${f(-tam * 0.2)} 0 ${f(-tam * 0.3)}" stroke="${vapor}" stroke-width="${f(tam * 0.04)}" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  }
  return out;
}

/** Revestimiento de madera: tablas horizontales con vetas, dentro de un rectángulo. */
function madera(r: Rect, colores: string[], veta: string, semilla: number): string {
  const rnd = azar(semilla);
  const alto = Math.max(6, r.w * 0.28);
  let out = "";
  for (let y = r.y, i = 0; y < r.y + r.h; y += alto, i++) {
    const h = Math.min(alto, r.y + r.h - y);
    out += `<rect x="${f(r.x)}" y="${f(y)}" width="${f(r.w)}" height="${f(h)}" fill="${colores[Math.floor(rnd() * colores.length)]!}"/>`;
    out += `<line x1="${f(r.x)}" y1="${f(y)}" x2="${f(r.x + r.w)}" y2="${f(y)}" stroke="${veta}" stroke-width="0.5" opacity="0.7"/>`;
    for (let k = 0; k < 2; k++) {
      const vy = y + h * (0.3 + k * 0.35 + rnd() * 0.1);
      out += `<path d="M ${f(r.x)} ${f(vy)} q ${f(r.w * 0.3)} ${f(-h * 0.08)} ${f(r.w * 0.6)} 0 t ${f(r.w * 0.6)} 0" stroke="${veta}" stroke-width="0.25" fill="none" opacity="0.45"/>`;
    }
  }
  return out;
}

/** Cinta escocesa (tartán) en franja horizontal. */
function escoces(r: Rect, fondo: string, raya: string, fina: string): string {
  const paso = r.h * 1.2;
  let out = `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="${fondo}"/>`;
  out += `<rect x="${f(r.x)}" y="${f(r.y + r.h * 0.35)}" width="${f(r.w)}" height="${f(r.h * 0.3)}" fill="${raya}" opacity="0.55"/>`;
  for (let x = r.x + paso * 0.3; x < r.x + r.w; x += paso) {
    out += `<rect x="${f(x)}" y="${f(r.y)}" width="${f(r.h * 0.3)}" height="${f(r.h)}" fill="${raya}" opacity="0.55"/>`;
    out += `<line x1="${f(x + paso / 2)}" y1="${f(r.y)}" x2="${f(x + paso / 2)}" y2="${f(r.y + r.h)}" stroke="${fina}" stroke-width="${f(r.h * 0.05)}"/>`;
  }
  return `${out}<line x1="${f(r.x)}" y1="${f(r.y + r.h * 0.5)}" x2="${f(r.x + r.w)}" y2="${f(r.y + r.h * 0.5)}" stroke="${fina}" stroke-width="${f(r.h * 0.05)}"/>`;
}

/** Banderín de slalom: un palo y un triángulo de tela. */
function banderin(x: number, base: number, alto: number, color: string, palo: string, haciaIzq = false): string {
  const s = haciaIzq ? -1 : 1;
  return `<line x1="${f(x)}" y1="${f(base)}" x2="${f(x)}" y2="${f(base - alto)}" stroke="${palo}" stroke-width="${f(alto * 0.035)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(base - alto)} L ${f(x + s * alto * 0.5)} ${f(base - alto * 0.84)} L ${f(x)} ${f(base - alto * 0.66)} Z" fill="${color}"/>`;
}

/** Huellas de esquí: dos líneas paralelas que bajan haciendo eses. */
function huellas(x: number, y: number, largo: number, angulo: number, color: string, grosor: number): string {
  const a = largo * 0.12;
  const sep = largo * 0.025;
  const d = (dy: number) => `M 0 ${f(dy)} c ${f(largo * 0.15)} ${f(-a)} ${f(largo * 0.3)} ${f(-a)} ${f(largo * 0.5)} 0 s ${f(largo * 0.35)} ${f(a)} ${f(largo * 0.5)} 0`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})" stroke="${color}" stroke-width="${f(grosor)}" fill="none" stroke-linecap="round"><path d="${d(-sep)}"/><path d="${d(sep)}"/></g>`;
}

/** Ramita de pino: un tallo con agujas finas a los dos lados. */
function ramitaPino(x: number, y: number, largo: number, angulo: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})" stroke="${color}" stroke-linecap="round"><line x1="0" y1="0" x2="${f(largo)}" y2="0" stroke-width="${f(largo * 0.014)}"/>`;
  const n = 22;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const px = largo * t;
    const l = largo * 0.16 * (1 - t * 0.55) * (0.85 + rnd() * 0.3);
    for (const lado of [-1, 1]) {
      const ang = (lado * (38 + rnd() * 12) * Math.PI) / 180;
      out += `<line x1="${f(px)}" y1="0" x2="${f(px + Math.cos(ang) * l)}" y2="${f(Math.sin(ang) * l)}" stroke-width="${f(largo * 0.008)}" opacity="${f(0.75 + rnd() * 0.25)}"/>`;
    }
  }
  return `${out}</g>`;
}

/** Montaña geométrica de póster: triángulo plano con un casquete de nieve en zigzag. */
function montanaPoster(cx: number, base: number, ancho: number, alto: number, color: string, nieve: string): string {
  const hw = ancho / 2;
  const t = 0.3;
  const lx = cx - hw * t;
  const rx = cx + hw * t;
  const y = base - alto * (1 - t);
  return `<path d="M ${f(cx - hw)} ${f(base)} L ${f(cx)} ${f(base - alto)} L ${f(cx + hw)} ${f(base)} Z" fill="${color}"/><path d="M ${f(cx)} ${f(base - alto)} L ${f(rx)} ${f(y)} L ${f(cx + hw * t * 0.4)} ${f(y - alto * 0.06)} L ${f(cx)} ${f(y + alto * 0.04)} L ${f(cx - hw * t * 0.45)} ${f(y - alto * 0.05)} L ${f(lx)} ${f(y)} Z" fill="${nieve}"/>`;
}

/** Pone en mayúsculas el título (los textos clásicos sólo lo hacen con el subtítulo). */
/** Corre los títulos para que no pisen un adorno: `dy` los baja, `izq`/`der` angostan la caja. */
const correr = (ts: TextoDelEstilo[], o: { dy?: number; izq?: number; der?: number }) =>
  ts.map((t) => ({ ...t, y: t.y + (o.dy ?? 0), x: t.x + (o.izq ?? 0), w: t.w - (o.izq ?? 0) - (o.der ?? 0) }));

const tituloEnMayusculas = (ts: TextoDelEstilo[]) => ts.map((t) => (t.rol === "titulo" ? { ...t, mayusculas: true } : t));

// ---------------------------------------------------------------------------------------------

export const NIEVE: EstiloFotolibro[] = [
  {
    id: "nieve-01-copos-glaciar",
    tema: "nieve",
    nombre: "Copos sobre azul glaciar",
    descripcion: "Celeste glaciar con copos blancos cayendo por los bordes. El clásico de las vacaciones de invierno.",
    papel: "#dceaf5",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const fondo = degradado("cg", total(m), "#eef5fb", "#bcd5ea");
      const banda = m.altoMm * 0.13;
      const tam = s * (fuerte(tipo) ? 0.05 : 0.04);
      const n = Math.round(m.anchoMm / (s * (fuerte(tipo) ? 0.035 : 0.055)));
      let c = fondo.cuerpo;
      if (tipo === "interior-alt") {
        // En el pliego alternativo, la nevada baja por los costados exteriores.
        const lado = izq.w * 0.12;
        c += nevada({ x: 0, y: 0, w: lado, h: m.altoMm }, "#ffffff", Math.round(n * 0.4), 11, tam);
        c += nevada({ x: der.x + der.w - lado, y: 0, w: lado, h: m.altoMm }, "#ffffff", Math.round(n * 0.4), 12, tam);
      } else {
        c += nevada({ x: 0, y: banda * 0.08, w: m.anchoMm, h: banda * 0.8 }, "#ffffff", n, 5, tam);
        c += nevada({ x: 0, y: m.altoMm - banda * 0.88, w: m.anchoMm, h: banda * 0.8 }, "#ffffff", n, 6, tam);
      }
      if (tipo === "apertura") c += copo(izq.x + izq.w / 2, m.altoMm * 0.2, s * 0.05, "#ffffff", s * 0.004);
      return svg(m, c, fondo.defs);
    },
    zona: zonaCon((tipo, _lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      if (tipo === "interior-alt") return { exterior: menos((m.anchoMm / 2) * 0.12 + s * 0.04, 14) + 3 };
      const b = menos(m.altoMm * 0.13 + s * 0.02, 14);
      return { arriba: b, abajo: b };
    }),
    textos: textosClasicos({
      titulo: "Playfair Display",
      texto: "Montserrat",
      color: "#1f4e79",
      acento: "#4a7db0",
      ejemplos: { titulo: "Invierno en Bariloche", subtitulo: "Vacaciones de invierno", fecha: "Julio 2026", frase: "Volveremos a la nieve" },
      escalaTitulo: 0.085,
    }),
  },
  {
    id: "nieve-02-bosque-nevado",
    tema: "nieve",
    nombre: "Bosque nevado",
    descripcion: "Una hilera de pinos con nieve al pie de las páginas, como en los cerros de la Patagonia.",
    papel: "#f4f7f9",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const cielo = degradado("bn", total(m), "#dfe9f0", "#f8fbfc");
      const alto = s * (fuerte(tipo) ? 0.26 : 0.19);
      const verdes = ["#9fb8b1", "#5f8a7d", "#2f5d50"];
      let c = cielo.cuerpo + nevada({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm * 0.12 }, "#9fb3c4", Math.round(m.anchoMm / (s * 0.06)), 4, s * 0.02, 0.7);
      if (tipo === "interior") {
        // Sólo dos bosquecitos en las puntas: deja el centro despejado.
        const w = izq.w * 0.3;
        c += bosque({ x: 0, y: 0, w, h: m.altoMm }, alto, verdes, "#ffffff", 8, "#ffffff");
        c += bosque({ x: der.x + der.w - w, y: 0, w, h: m.altoMm }, alto, verdes, "#ffffff", 9, "#ffffff");
      } else {
        c += bosque(total(m), alto, verdes, "#ffffff", tipo === "interior-alt" ? 3 : 2, "#ffffff");
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = s * (fuerte(tipo) ? 0.26 : 0.19);
      const titulo = (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
      return { abajo: menos(alto * (titulo ? 0.75 : 1), 14) + 2, arriba: menos(m.altoMm * 0.12, 14) };
    }, "arriba"),
    textos: textosClasicos({
      titulo: "Libre Baskerville",
      texto: "Lato",
      color: "#2f5d50",
      acento: "#5f8a7d",
      ejemplos: { titulo: "Chapelco 2026", subtitulo: "Bosque, nieve y familia", fecha: "Julio 2026", frase: "El invierno más lindo" },
      escalaTitulo: 0.08,
      posicion: "arriba",
    }),
  },
  {
    id: "nieve-03-tejido-nordico",
    tema: "nieve",
    nombre: "Tejido nórdico",
    descripcion: "Guardas rojas de pulóver tejido sobre crema: calidez de gorro de lana y vacaciones en familia.",
    papel: "#f6f0e6",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const g = grano("tn", m, 0.07, 1.2);
      const h = m.altoMm * (fuerte(tipo) ? 0.1 : 0.075);
      let c = fondoLiso(total(m), "#f6f0e6");
      const arriba = tipo !== "interior-alt";
      const abajo = tipo !== "interior";
      if (arriba) c += guardaNordica(0, m.altoMm * 0.03, m.anchoMm, h, "#b3262e", "#f6f0e6");
      if (abajo) c += guardaNordica(0, m.altoMm * 0.97 - h, m.anchoMm, h, tipo === "interior-alt" ? "#1f3b5a" : "#b3262e", "#f6f0e6");
      // Un hilo fino que acompaña cada guarda.
      if (arriba) c += `<line x1="0" y1="${f(m.altoMm * 0.03 + h * 1.18)}" x2="${f(m.anchoMm)}" y2="${f(m.altoMm * 0.03 + h * 1.18)}" stroke="#b3262e" stroke-width="0.5"/>`;
      if (abajo) c += `<line x1="0" y1="${f(m.altoMm * 0.97 - h * 1.18)}" x2="${f(m.anchoMm)}" y2="${f(m.altoMm * 0.97 - h * 1.18)}" stroke="#b3262e" stroke-width="0.5"/>`;
      if (tipo === "apertura") c += copo(izq.x + izq.w / 2, m.altoMm * 0.24, Math.min(izq.w, izq.h) * 0.035, "#b3262e", 0.6);
      if (tipo === "cierre") c += copo(der.x + der.w / 2, m.altoMm * 0.3, Math.min(der.w, der.h) * 0.025, "#b3262e", 0.6);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const h = m.altoMm * (fuerte(tipo) ? 0.1 : 0.075) * 1.18 + m.altoMm * 0.03;
      // En el cierre la frase baja para no pisar la guarda: las fotos también.
      if (tipo === "cierre" && lado === "der") return { arriba: m.altoMm * 0.36, abajo: menos(h, 12) + 3 };
      return { arriba: tipo !== "interior-alt" ? menos(h, 12) + 3 : 0, abajo: tipo !== "interior" ? menos(h, 12) + 3 : 0 };
    }),
    textos: (tipo, m) => {
      const ts = textosClasicos({
        titulo: "Amatic SC",
        texto: "Patrick Hand",
        color: "#b3262e",
        acento: "#1f3b5a",
        ejemplos: { titulo: "Invierno en familia", subtitulo: "Bariloche", fecha: "Julio 2026", frase: "Calentitos y juntos" },
        escalaTitulo: 0.11,
      })(tipo, m);
      return tipo === "cierre" ? correr(ts, { dy: m.altoMm * 0.07 }) : ts;
    },
  },
  {
    id: "nieve-04-aurora-austral",
    tema: "nieve",
    nombre: "Aurora austral",
    descripcion: "Cielo nocturno del fin del mundo con aurora verde y violeta sobre la cordillera. Ideal para Ushuaia.",
    papel: "#0b1630",
    margenMm: 14,
    fondo: (tipo, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const cielo = degradado("ac", total(m), "#07112a", "#16304f");
      const blur = `<filter id="au" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${f(m.altoMm * 0.03)}"/></filter>`;
      const alto = m.altoMm * (fuerte(tipo) ? 0.5 : 0.36);
      let c = cielo.cuerpo;
      c += estrellas(total(m), "#e9f1ff", Math.round((m.anchoMm * (fuerte(tipo) ? 0.35 : 0.18))), 17, s * 0.012);
      c += aurora(m, alto, tipo === "interior-alt" ? ["#8a5cf6", "#3ddc97", "#2bb5a0"] : ["#3ddc97", "#2bb5a0", "#8a5cf6"], fuerte(tipo) ? 0.55 : 0.32, tipo === "interior-alt" ? 7 : 3, "au");
      const hm = m.altoMm * (fuerte(tipo) ? 0.2 : 0.13);
      c += siluetaCordillera(total(m), hm, "#0f2440", 5, Math.max(4, Math.round(m.anchoMm / (s * 0.5))));
      c += siluetaCordillera(total(m), hm * 0.62, "#050b1a", 8, Math.max(5, Math.round(m.anchoMm / (s * 0.32))));
      return svg(m, c, cielo.defs + blur);
    },
    zona: zonaCon((tipo, lado, m) => {
      const hm = m.altoMm * (fuerte(tipo) ? 0.2 : 0.13);
      const titulo = (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
      return { abajo: menos(hm * (titulo ? 0.6 : 1), 14) + 2 };
    }),
    textos: textosClasicos({
      titulo: "Playfair Display",
      texto: "Raleway",
      color: "#e8f6ff",
      acento: "#7ee8c0",
      ejemplos: { titulo: "Ushuaia 2026", subtitulo: "El fin del mundo", fecha: "Julio 2026", frase: "Bajo el cielo austral" },
      escalaTitulo: 0.1,
    }),
  },
  {
    id: "nieve-05-chocolate-cabana",
    tema: "nieve",
    nombre: "Chocolate en la cabaña",
    descripcion: "Revestimiento de madera, una taza de chocolate humeante y cuadrillé escocés: el refugio después de la nieve.",
    papel: "#f3e6d6",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("cc", m, 0.08, 1);
      const franja = Math.max(izq.w * 0.13, s * 0.12);
      const maderas = ["#8b5a3c", "#7a4c31", "#94603f", "#83553a"];
      let c = fondoLiso(total(m), "#f3e6d6");
      c += madera({ x: 0, y: 0, w: franja, h: m.altoMm }, maderas, "#4a2d1c", 3);
      c += madera({ x: der.x + der.w - franja, y: 0, w: franja, h: m.altoMm }, maderas, "#4a2d1c", 4);
      c += `<rect x="${f(franja)}" y="0" width="${f(franja * 0.04)}" height="${f(m.altoMm)}" fill="#4a2d1c" opacity="0.35"/><rect x="${f(der.x + der.w - franja * 1.04)}" y="0" width="${f(franja * 0.04)}" height="${f(m.altoMm)}" fill="#4a2d1c" opacity="0.35"/>`;
      if (tipo === "interior-alt") c += escoces({ x: franja, y: m.altoMm * 0.95, w: m.anchoMm - 2 * franja, h: m.altoMm * 0.05 }, "#a8322d", "#5a1f1c", "#f0c96a");
      const tz = franja * 0.62;
      if (tipo === "apertura") c += taza(franja / 2, m.altoMm - s * 0.05, tz, "#f6efe6", "#5a3420", "#f6efe6");
      if (tipo === "cierre") c += taza(der.x + der.w - franja / 2, m.altoMm - s * 0.05, tz, "#f6efe6", "#5a3420", "#f6efe6");
      if (fuerte(tipo)) {
        // Copitos de nieve sueltos sobre la madera, arriba.
        c += nevada({ x: 0, y: 0, w: franja, h: m.altoMm * 0.5 }, "#fff8ef", 7, 21, franja * 0.12);
        c += nevada({ x: der.x + der.w - franja, y: 0, w: franja, h: m.altoMm * 0.5 }, "#fff8ef", 7, 22, franja * 0.12);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, _lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const franja = Math.max((m.anchoMm / 2) * 0.13, s * 0.12);
      return { exterior: menos(franja * 1.05, 12) + 4, abajo: tipo === "interior-alt" ? menos(m.altoMm * 0.05, 12) + 3 : 0 };
    }),
    textos: (tipo, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const franja = Math.max((m.anchoMm / 2) * 0.13, s * 0.12);
      const ts = textosClasicos({
        titulo: "Caveat",
        texto: "Nunito",
        color: "#5a3420",
        acento: "#a8322d",
        ejemplos: { titulo: "Cabaña en La Angostura", subtitulo: "Chocolate, nieve y fuego", fecha: "Julio 2026", frase: "Lo mejor fue estar juntos" },
        escalaTitulo: 0.09,
      })(tipo, m);
      // La caja del título arranca después de la madera (y la frase termina antes).
      return correr(ts, tipo === "apertura" ? { izq: franja * 0.6 } : { der: franja * 0.6 });
    },
  },
  {
    id: "nieve-06-pista-esqui",
    tema: "nieve",
    nombre: "Pista de esquí",
    descripcion: "Deportivo y moderno: triángulos azul y rojo, banderines de slalom y huellas de esquí.",
    papel: "#ffffff",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const T = s * (fuerte(tipo) ? 0.36 : 0.26);
      const H = m.altoMm;
      let c = fondoLiso(total(m), "#ffffff");
      // Esquina con un triángulo azul, una cinta roja y huellas blancas.
      const esquina = (x: number, y: number, sx: number, sy: number) => {
        let o = `<path d="M ${f(x)} ${f(y)} L ${f(x + sx * T)} ${f(y)} L ${f(x)} ${f(y + sy * T)} Z" fill="#1d3557"/>`;
        o += `<path d="M ${f(x + sx * T)} ${f(y)} L ${f(x + sx * T * 1.12)} ${f(y)} L ${f(x)} ${f(y + sy * T * 1.12)} L ${f(x)} ${f(y + sy * T)} Z" fill="#e63946"/>`;
        o += `<path d="M ${f(x + sx * T * 1.18)} ${f(y)} L ${f(x + sx * T * 1.21)} ${f(y)} L ${f(x)} ${f(y + sy * T * 1.21)} L ${f(x)} ${f(y + sy * T * 1.18)} Z" fill="#a8dadc"/>`;
        o += huellas(x + sx * T * 0.06, y + sy * T * 0.42, T * 0.6, sx * sy > 0 ? -45 : 45, "#ffffff", T * 0.008);
        if (sx * sy < 0) {
          o += huellas(x + sx * T * 0.04, y + sy * T * 0.28, T * 0.45, -40 * (sy > 0 ? 1 : -1) * (sx > 0 ? 1 : -1), "#a8dadc", T * 0.006);
        } else {
          o += huellas(x + sx * T * 0.04, y + sy * T * 0.6, T * 0.3, 45, "#a8dadc", T * 0.006);
        }
        return o;
      };
      if (tipo === "interior-alt" || tipo === "cierre") {
        c += esquina(izq.x, 0, 1, 1) + esquina(der.x + der.w, H, -1, -1);
      } else {
        c += esquina(izq.x, H, 1, -1) + esquina(der.x + der.w, 0, -1, 1);
      }
      if (fuerte(tipo)) {
        // Banderines de slalom sobre la diagonal.
        const sx = tipo === "apertura" ? 1 : -1;
        const x0 = tipo === "apertura" ? izq.x : der.x + der.w;
        for (let i = 0; i < 2; i++) {
          const t = 0.22 + i * 0.3;
          const bx = x0 + sx * T * t;
          const by = H - T * (1 - t) * 0.6;
          c += banderin(bx, by, T * 0.2, i % 2 ? "#e63946" : "#ffffff", "#ffffff", sx < 0);
        }
      }
      return svg(m, c);
    },
    // El triángulo se libra con margen exterior más margen arriba/abajo (la esquina de la caja queda fuera).
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const T = s * (fuerte(tipo) ? 0.36 : 0.26) * 1.24;
      const resto = menos(T, 24) / 2 + 2;
      const enEsquinaArriba = tipo === "interior-alt" || tipo === "cierre" ? lado === "izq" : lado === "der";
      // En la página del título casi no queda alto: se reserva de costado.
      if (tipo === "apertura" && lado === "izq") return { exterior: resto * 1.6, abajo: resto * 0.4 + 2 };
      return enEsquinaArriba ? { exterior: resto, arriba: resto } : { exterior: resto, abajo: resto };
    }),
    textos: (tipo, m) =>
      tituloEnMayusculas(
        textosClasicos({
          titulo: "Bebas Neue",
          texto: "Work Sans",
          color: "#1d3557",
          acento: "#e63946",
          ejemplos: { titulo: "Las Leñas 2026", subtitulo: "Semana de esquí", fecha: "Julio 2026", frase: "Nos vemos en la cumbre" },
          escalaTitulo: 0.12,
        })(tipo, m),
      ),
  },
  {
    id: "nieve-07-acuarela-invernal",
    tema: "nieve",
    nombre: "Acuarela invernal",
    descripcion: "Manchas de acuarela azul y lavanda con ramitas de pino pegadas a los bordes. Delicado y luminoso.",
    papel: "#fbfcfe",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const k = fuerte(tipo) ? 1 : 0.75;
      const g = grano("ai", m, 0.04);
      let c = fondoLiso(total(m), "#fbfcfe");
      // Cada rincón: dos manchas y ramitas que corren pegadas al borde de arriba y al costado.
      const rincon = (x: number, y: number, sx: number, sy: number, sem: number) => {
        let o = manchaAcuarela(x + sx * s * 0.06, y + sy * s * 0.05, s * 0.2 * k, "#8fb3d9", "wa", sem);
        o += manchaAcuarela(x + sx * s * 0.16, y + sy * s * 0.03, s * 0.12 * k, "#b8a9d9", "wa", sem + 3, 2);
        const angH = sx > 0 ? (sy > 0 ? 6 : -6) : sy > 0 ? 174 : 186;
        const angV = sy > 0 ? (sx > 0 ? 84 : 96) : sx > 0 ? -84 : -96;
        o += ramitaPino(x + sx * s * 0.01, y + sy * s * 0.03, s * 0.42 * k, angH, "#3e6b6b", sem + 5);
        o += ramitaPino(x + sx * s * 0.03, y + sy * s * 0.01, s * 0.3 * k, angV, "#5d8a87", sem + 7);
        o += ramitaPino(x + sx * s * 0.02, y + sy * s * 0.02, s * 0.22 * k, (angH + angV) / 2, "#2f5656", sem + 9);
        o += copo(x + sx * s * 0.2 * k, y + sy * s * 0.1 * k, s * 0.022, "#6f8fbf", 0.35);
        return o;
      };
      if (tipo === "interior-alt") c += rincon(der.x + der.w, 0, -1, 1, 30) + rincon(izq.x, m.altoMm, 1, -1, 40);
      else c += rincon(izq.x, 0, 1, 1, 10) + rincon(der.x + der.w, m.altoMm, -1, -1, 20);
      return svg(m, c + g.cuerpo, filtroAcuarela("wa", 5) + g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const k = fuerte(tipo) ? 1 : 0.75;
      const b = menos(s * 0.13 * k, 14) + 3;
      const arribaEnIzq = tipo !== "interior-alt";
      const rinconArriba = (lado === "izq") === arribaEnIzq;
      return rinconArriba ? { arriba: b, exterior: b * 0.6 } : { abajo: b, exterior: b * 0.6 };
    }),
    textos: textosClasicos({
      titulo: "Parisienne",
      texto: "Lora",
      color: "#2c4a6b",
      acento: "#6f8fbf",
      ejemplos: { titulo: "Nuestro invierno", subtitulo: "Cerro Catedral · Bariloche", fecha: "Julio 2026", frase: "Copos que se quedan para siempre" },
      escalaTitulo: 0.11,
    }),
  },
  {
    id: "nieve-08-cordillera-minimal",
    tema: "nieve",
    nombre: "Cordillera minimal",
    descripcion: "Una sola línea fina dibuja la cordillera. Mucho aire y tipografía limpia para fotos que hablan solas.",
    papel: "#f5f5f3",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const alto = m.altoMm * (fuerte(tipo) ? 0.15 : 0.1);
      const r = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm * 0.95 };
      let c = fondoLiso(total(m), "#f5f5f3");
      if (tipo === "interior") c += lineaCordillera({ x: izq.x + izq.w * 0.05, y: 0, w: izq.w * 0.45, h: r.h }, alto, "#6b7682", 0.45, 6, 3);
      else if (tipo === "interior-alt") c += lineaCordillera({ x: der.x + der.w * 0.5, y: 0, w: der.w * 0.45, h: r.h }, alto, "#6b7682", 0.45, 9, 3);
      else c += lineaCordillera({ x: m.anchoMm * 0.04, y: 0, w: m.anchoMm * 0.92, h: r.h }, alto, "#4f5a66", 0.5, 4, Math.max(5, Math.round(m.anchoMm / (s * 0.3))));
      if (tipo === "apertura") c += `<circle cx="${f(izq.x + izq.w / 2)}" cy="${f(m.altoMm * 0.2)}" r="${f(s * 0.03)}" fill="none" stroke="#b08d57" stroke-width="0.4"/>`;
      if (fuerte(tipo)) c += `<line x1="${f(m.anchoMm * 0.04)}" y1="${f(r.h)}" x2="${f(m.anchoMm * 0.96)}" y2="${f(r.h)}" stroke="#6b7682" stroke-width="0.25"/>`;
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      // En la página del título la línea queda debajo de todo: alcanza con reservar el pie.
      const titulo = (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
      return { abajo: menos(m.altoMm * (0.05 + (fuerte(tipo) ? 0.15 : 0.1)) * (titulo ? 0.6 : 1), 16) + 3 };
    }),
    textos: (tipo, m) =>
      tituloEnMayusculas(
        textosClasicos({
          titulo: "Montserrat",
          texto: "Raleway",
          color: "#3c4650",
          acento: "#b08d57",
          ejemplos: { titulo: "Chapelco", subtitulo: "San Martín de los Andes", fecha: "Invierno 2026", frase: "Quietud blanca" },
          escalaTitulo: 0.075,
        })(tipo, m),
      ),
  },
  {
    id: "nieve-09-poster-retro",
    tema: "nieve",
    nombre: "Póster retro de esquí",
    descripcion: "Franjas setentosas mostaza, naranja y petróleo con montañas geométricas y sol: aire de afiche vintage.",
    papel: "#f2e8d5",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const H = m.altoMm;
      const g = grano("pr", m, 0.1, 1.1);
      const colores = ["#e9b44c", "#e07a3f", "#1f6f78"];
      const raya = H * (fuerte(tipo) ? 0.03 : 0.022);
      const franjas = (y0: number, haciaArriba: boolean) =>
        colores.map((c, i) => `<rect x="0" y="${f(haciaArriba ? y0 - (i + 1) * raya : y0 + i * raya)}" width="${f(m.anchoMm)}" height="${f(raya * 0.82)}" fill="${c}"/>`).join("");
      let c = fondoLiso(total(m), "#f2e8d5");
      if (fuerte(tipo)) {
        const p = tipo === "apertura" ? der : izq;
        const pie = H - raya * 3.2;
        // El sol detrás de las montañas, en la página que no lleva el título.
        c += `<circle cx="${f(p.x + p.w * 0.62)}" cy="${f(pie - s * 0.1)}" r="${f(s * 0.12)}" fill="#e07a3f"/>`;
        c += montanaPoster(p.x + p.w * 0.38, pie, s * 0.5, s * 0.24, "#1f6f78", "#fffaf0");
        c += montanaPoster(p.x + p.w * 0.7, pie, s * 0.42, s * 0.17, "#2f8f8f", "#fffaf0");
        c += montanaPoster(p.x + p.w * 0.1, pie, s * 0.3, s * 0.12, "#2f8f8f", "#fffaf0");
        c += `<rect x="${f(p.x)}" y="${f(pie)}" width="${f(p.w)}" height="${f(raya * 0.4)}" fill="#fffaf0"/>`;
      }
      c += tipo === "interior-alt" ? franjas(H * 0.04, false) : franjas(H - H * 0.04, true);
      if (tipo === "interior") c += `<rect x="0" y="${f(H * 0.04)}" width="${f(m.anchoMm)}" height="${f(raya * 0.4)}" fill="#1f6f78"/>`;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const H = m.altoMm;
      const raya = H * (fuerte(tipo) ? 0.03 : 0.022);
      const franjas = menos(H * 0.04 + raya * 3, 13) + 3;
      if (tipo === "interior-alt") return { arriba: franjas };
      if (tipo === "interior") return { abajo: franjas, arriba: menos(H * 0.04 + raya * 0.4, 13) + 2 };
      const montes = (tipo === "apertura" && lado === "der") || (tipo === "cierre" && lado === "izq");
      return { abajo: montes ? menos(raya * 3.2 + s * 0.24, 13) + 3 : franjas };
    }),
    textos: (tipo, m) =>
      tituloEnMayusculas(
        textosClasicos({
          titulo: "Anton",
          texto: "Oswald",
          color: "#1f6f78",
          acento: "#e07a3f",
          ejemplos: { titulo: "Cerro Castor 2026", subtitulo: "Ushuaia · Tierra del Fuego", fecha: "Julio 2026", frase: "¡Hasta la próxima temporada!" },
          escalaTitulo: 0.075,
        })(tipo, m),
      ),
  },
  {
    id: "nieve-10-escarcha-plateada",
    tema: "nieve",
    nombre: "Escarcha plateada",
    descripcion: "Gris pizarra con doble filete plateado, copos en las esquinas y destellos de escarcha. Elegante y nocturno.",
    papel: "#2b3440",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const fondo = degradado("ep", total(m), "#344050", "#1e2630");
      const sep = s * 0.045;
      let c = fondo.cuerpo;
      for (const p of [izq, der]) {
        c += filete(p, sep, "#c0c7d0", 0.4) + filete(p, sep + s * 0.012, "#c0c7d0", 0.2);
        const esq: [number, number][] = [
          [p.x + sep, sep],
          [p.x + p.w - sep, sep],
          [p.x + sep, p.h - sep],
          [p.x + p.w - sep, p.h - sep],
        ];
        for (const [x, y] of esq) c += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.034)}" fill="#29323d"/>` + copo(x, y, s * 0.028, "#dfe5ec", 0.4);
        // Escarcha: destellos finos sólo en la franja entre el borde y el filete.
        const banda = sep * 1.4;
        const n = Math.round((p.w + p.h) / (fuerte(tipo) ? 5 : 9));
        c += estrellas({ x: p.x, y: 0, w: p.w, h: banda }, "#e6ebf1", Math.round(n * 0.3), p.x > 0 ? 3 : 4, s * 0.012);
        c += estrellas({ x: p.x, y: p.h - banda, w: p.w, h: banda }, "#e6ebf1", Math.round(n * 0.3), p.x > 0 ? 5 : 6, s * 0.012);
      }
      if (tipo === "apertura") c += copo(izq.x + izq.w / 2, m.altoMm * 0.2, s * 0.04, "#dfe5ec", 0.45);
      if (tipo === "interior-alt") {
        // Un copo grande y tenue en el centro de la costura.
        c += copo(m.anchoMm / 2, m.altoMm / 2, s * 0.1, "#46525f", 0.6);
      }
      return svg(m, c, fondo.defs);
    },
    zona: zonaCon((_tipo, _lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const b = menos(s * 0.045 + s * 0.04, 16) + 3;
      return { arriba: b, abajo: b, exterior: b, interior: b };
    }),
    textos: textosClasicos({
      titulo: "Great Vibes",
      texto: "Playfair Display",
      color: "#eef2f6",
      acento: "#c0c7d0",
      ejemplos: { titulo: "Diario de invierno", subtitulo: "Ushuaia, fin del mundo", fecha: "Agosto 2026", frase: "Cada copo, un recuerdo" },
      escalaTitulo: 0.11,
    }),
  },
];
