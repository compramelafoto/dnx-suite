import type { EstiloFotolibro, Medidas, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { azar, degradado, fondoLiso, grano, paginas, rama, svg, type Rect } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos de Europa: viajes por París, Roma, Barcelona, Londres, Grecia, Ámsterdam… Postales,
 * sellos de pasaporte, mapas, azulejos, boletos de tren y siluetas de monumentos dibujadas con
 * formas simples (genéricas, sin marcas ni logos).
 */

const f = (n: number) => Math.round(n * 100) / 100;
const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";
const total = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });
const corto = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);
const deTitulo = (tipo: TipoPliego, lado: "izq" | "der") => (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");

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

/** Corre los títulos para que no pisen un adorno: `dy` los baja, `izq`/`der` angostan la caja. */
const correr = (ts: TextoDelEstilo[], o: { dy?: number; izq?: number; der?: number }) =>
  ts.map((t) => ({ ...t, y: t.y + (o.dy ?? 0), x: t.x + (o.izq ?? 0), w: t.w - (o.izq ?? 0) - (o.der ?? 0) }));

const tituloEnMayusculas = (ts: TextoDelEstilo[]) => ts.map((t) => (t.rol === "titulo" ? { ...t, mayusculas: true } : t));

// ---------------------------------------------------------------------------------------------
// Monumentos: siluetas genéricas con formas simples. Todos se paran sobre `base`, centrados en x.
// `hueco` es el color del papel, para calar arcos y ventanas.
// ---------------------------------------------------------------------------------------------

type Monumento = (x: number, base: number, alto: number, color: string, hueco: string) => string;

/** Torre de hierro de patas curvas (la de París, dibujada simple). Ancho ≈ 0,42 del alto. */
const torre: Monumento = (x, base, h, c, hueco) => {
  const w = h * 0.42;
  let o = `<path d="M ${f(x - w / 2)} ${f(base)} Q ${f(x - w * 0.14)} ${f(base - h * 0.4)} ${f(x - w * 0.045)} ${f(base - h * 0.9)} L ${f(x)} ${f(base - h)} L ${f(x + w * 0.045)} ${f(base - h * 0.9)} Q ${f(x + w * 0.14)} ${f(base - h * 0.4)} ${f(x + w / 2)} ${f(base)} Z" fill="${c}"/>`;
  o += `<path d="M ${f(x - w * 0.26)} ${f(base)} Q ${f(x)} ${f(base - h * 0.3)} ${f(x + w * 0.26)} ${f(base)} Z" fill="${hueco}"/>`;
  o += `<rect x="${f(x - w * 0.3)}" y="${f(base - h * 0.33)}" width="${f(w * 0.6)}" height="${f(h * 0.025)}" fill="${c}"/>`;
  o += `<rect x="${f(x - w * 0.16)}" y="${f(base - h * 0.62)}" width="${f(w * 0.32)}" height="${f(h * 0.018)}" fill="${c}"/>`;
  return o;
};

/** Anfiteatro romano, con el lado derecho derrumbado y tres pisos de arcos. Ancho ≈ 1,5 del alto. */
const coliseo: Monumento = (x, base, h, c, hueco) => {
  const H = h * 0.55;
  const w = h * 1.5;
  const x0 = x - w / 2;
  let o = `<path d="M ${f(x0)} ${f(base)} L ${f(x0)} ${f(base - H)} L ${f(x0 + w * 0.7)} ${f(base - H)} L ${f(x0 + w * 0.82)} ${f(base - H * 0.72)} L ${f(x0 + w * 0.9)} ${f(base - H * 0.62)} L ${f(x0 + w)} ${f(base - H * 0.3)} L ${f(x0 + w)} ${f(base)} Z" fill="${c}"/>`;
  const filas = 3;
  const cols = 9;
  for (let j = 0; j < filas; j++) {
    const y1 = base - (H * (j + 0.15)) / filas;
    const ah = (H / filas) * 0.62;
    for (let i = 0; i < cols; i++) {
      const ax = x0 + w * 0.04 + (i * w * 0.92) / cols;
      const aw = ((w * 0.92) / cols) * 0.55;
      // Sólo donde queda pared (el lado derrumbado va bajando).
      const techo = ax > x0 + w * 0.7 ? base - H * (1 - ((ax - x0 - w * 0.7) / (w * 0.3)) * 0.7) : base - H;
      if (y1 - ah - aw * 0.3 < techo + H * 0.04) continue;
      o += `<path d="M ${f(ax)} ${f(y1)} L ${f(ax)} ${f(y1 - ah + aw / 2)} A ${f(aw / 2)} ${f(aw / 2)} 0 0 1 ${f(ax + aw)} ${f(y1 - ah + aw / 2)} L ${f(ax + aw)} ${f(y1)} Z" fill="${hueco}"/>`;
    }
  }
  return o;
};

/** Torre del reloj con aguja (la de Londres, simplificada). Ancho ≈ 0,2 del alto. */
const torreReloj: Monumento = (x, base, h, c, hueco) => {
  const w = h * 0.15;
  let o = `<rect x="${f(x - w / 2)}" y="${f(base - h * 0.72)}" width="${f(w)}" height="${f(h * 0.72)}" fill="${c}"/>`;
  o += `<rect x="${f(x - w * 0.62)}" y="${f(base - h * 0.84)}" width="${f(w * 1.24)}" height="${f(h * 0.13)}" fill="${c}"/>`;
  o += `<circle cx="${f(x)}" cy="${f(base - h * 0.775)}" r="${f(w * 0.42)}" fill="${hueco}"/><circle cx="${f(x)}" cy="${f(base - h * 0.775)}" r="${f(w * 0.08)}" fill="${c}"/>`;
  o += `<path d="M ${f(x - w * 0.62)} ${f(base - h * 0.84)} L ${f(x)} ${f(base - h)} L ${f(x + w * 0.62)} ${f(base - h * 0.84)} Z" fill="${c}"/>`;
  for (let i = 0; i < 3; i++) o += `<rect x="${f(x - w * 0.25)}" y="${f(base - h * (0.22 + i * 0.16))}" width="${f(w * 0.5)}" height="${f(h * 0.06)}" fill="${hueco}" opacity="0.8"/>`;
  return o;
};

/** Templo griego: escalinata, columnas y frontón. Ancho ≈ 1,2 del alto. */
const templo: Monumento = (x, base, h, c, hueco) => {
  const H = h * 0.5;
  const w = h * 1.2;
  const x0 = x - w / 2;
  let o = `<rect x="${f(x0)}" y="${f(base - H * 0.1)}" width="${f(w)}" height="${f(H * 0.1)}" fill="${c}"/>`;
  o += `<rect x="${f(x0 + w * 0.03)}" y="${f(base - H * 0.18)}" width="${f(w * 0.94)}" height="${f(H * 0.08)}" fill="${c}"/>`;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const cx = x0 + w * 0.1 + (i * w * 0.8) / (n - 1);
    o += `<rect x="${f(cx - w * 0.03)}" y="${f(base - H * 0.8)}" width="${f(w * 0.06)}" height="${f(H * 0.62)}" fill="${c}"/>`;
  }
  o += `<rect x="${f(x0 + w * 0.03)}" y="${f(base - H * 0.94)}" width="${f(w * 0.94)}" height="${f(H * 0.14)}" fill="${c}"/>`;
  o += `<path d="M ${f(x0)} ${f(base - H * 0.94)} L ${f(x)} ${f(base - H * 1.3)} L ${f(x0 + w)} ${f(base - H * 0.94)} Z" fill="${c}"/>`;
  o += `<path d="M ${f(x0 + w * 0.14)} ${f(base - H * 0.99)} L ${f(x)} ${f(base - H * 1.22)} L ${f(x0 + w * 0.86)} ${f(base - H * 0.99)} Z" fill="${hueco}" opacity="0.35"/>`;
  return o;
};

/** Molino de viento holandés. Ancho ≈ 0,7 del alto. */
const molino: Monumento = (x, base, h, c, hueco) => {
  const w = h * 0.3;
  const top = base - h * 0.62;
  let o = `<path d="M ${f(x - w / 2)} ${f(base)} L ${f(x - w * 0.3)} ${f(top)} L ${f(x + w * 0.3)} ${f(top)} L ${f(x + w / 2)} ${f(base)} Z" fill="${c}"/>`;
  o += `<path d="M ${f(x - w * 0.36)} ${f(top)} Q ${f(x)} ${f(top - w * 0.6)} ${f(x + w * 0.36)} ${f(top)} Z" fill="${c}"/>`;
  o += `<path d="M ${f(x - w * 0.12)} ${f(base)} L ${f(x - w * 0.12)} ${f(base - w * 0.32)} A ${f(w * 0.12)} ${f(w * 0.12)} 0 0 1 ${f(x + w * 0.12)} ${f(base - w * 0.32)} L ${f(x + w * 0.12)} ${f(base)} Z" fill="${hueco}"/>`;
  const cy = top - w * 0.15;
  const L = h * 0.36;
  for (const a of [35, 125, 215, 305]) {
    o += `<g transform="translate(${f(x)} ${f(cy)}) rotate(${a})"><rect x="0" y="${f(-L * 0.02)}" width="${f(L)}" height="${f(L * 0.04)}" fill="${c}"/><rect x="${f(L * 0.3)}" y="${f(L * 0.02)}" width="${f(L * 0.68)}" height="${f(L * 0.16)}" fill="${c}" opacity="0.85"/></g>`;
  }
  return o + `<circle cx="${f(x)}" cy="${f(cy)}" r="${f(w * 0.08)}" fill="${hueco}"/>`;
};

/** Iglesia de cúpula (tipo catedral italiana). Ancho ≈ 0,6 del alto. */
const cupula: Monumento = (x, base, h, c, hueco) => {
  const w = h * 0.6;
  let o = `<rect x="${f(x - w / 2)}" y="${f(base - h * 0.3)}" width="${f(w)}" height="${f(h * 0.3)}" fill="${c}"/>`;
  o += `<rect x="${f(x - w * 0.3)}" y="${f(base - h * 0.45)}" width="${f(w * 0.6)}" height="${f(h * 0.15)}" fill="${c}"/>`;
  o += `<path d="M ${f(x - w * 0.3)} ${f(base - h * 0.45)} Q ${f(x - w * 0.3)} ${f(base - h * 0.88)} ${f(x)} ${f(base - h * 0.9)} Q ${f(x + w * 0.3)} ${f(base - h * 0.88)} ${f(x + w * 0.3)} ${f(base - h * 0.45)} Z" fill="${c}"/>`;
  o += `<rect x="${f(x - w * 0.04)}" y="${f(base - h)}" width="${f(w * 0.08)}" height="${f(h * 0.12)}" fill="${c}"/>`;
  for (let i = 0; i < 4; i++) {
    const ax = x - w * 0.38 + i * w * 0.22;
    o += `<path d="M ${f(ax)} ${f(base)} L ${f(ax)} ${f(base - h * 0.14)} A ${f(w * 0.05)} ${f(w * 0.05)} 0 0 1 ${f(ax + w * 0.1)} ${f(base - h * 0.14)} L ${f(ax + w * 0.1)} ${f(base)} Z" fill="${hueco}"/>`;
  }
  return o;
};

/** Torre inclinada de pisos con arcos. Ancho ≈ 0,35 del alto. */
const torreInclinada: Monumento = (x, base, h, c, hueco) => {
  const w = h * 0.24;
  let o = `<g transform="rotate(5 ${f(x)} ${f(base)})"><rect x="${f(x - w / 2)}" y="${f(base - h * 0.9)}" width="${f(w)}" height="${f(h * 0.9)}" fill="${c}"/><rect x="${f(x - w * 0.36)}" y="${f(base - h)}" width="${f(w * 0.72)}" height="${f(h * 0.1)}" fill="${c}"/>`;
  for (let i = 0; i < 6; i++) {
    const y = base - h * (0.1 + i * 0.135);
    o += `<rect x="${f(x - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(h * 0.012)}" fill="${hueco}"/>`;
    for (let k = 0; k < 3; k++) o += `<rect x="${f(x - w * 0.36 + k * w * 0.27)}" y="${f(y - h * 0.09)}" width="${f(w * 0.14)}" height="${f(h * 0.07)}" rx="${f(w * 0.07)}" fill="${hueco}" opacity="0.7"/>`;
  }
  return o + "</g>";
};

const MONUMENTOS: { dibujo: Monumento; ancho: number }[] = [
  { dibujo: torre, ancho: 0.45 },
  { dibujo: coliseo, ancho: 1.55 },
  { dibujo: torreReloj, ancho: 0.22 },
  { dibujo: templo, ancho: 1.25 },
  { dibujo: molino, ancho: 0.75 },
  { dibujo: cupula, ancho: 0.62 },
  { dibujo: torreInclinada, ancho: 0.35 },
];

/** Una línea de horizonte con monumentos y edificios bajos entre medio, sobre el pie de `r`. */
function horizonte(r: Rect, alto: number, color: string, hueco: string, semilla: number, inicio = 0): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  let out = "";
  let x = r.x + alto * 0.1;
  let i = inicio;
  while (x < r.x + r.w - alto * 0.2) {
    // Edificios bajos de relleno.
    const nRelleno = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < nRelleno && x < r.x + r.w; k++) {
      const bw = alto * (0.12 + rnd() * 0.16);
      const bh = alto * (0.14 + rnd() * 0.2);
      out += `<rect x="${f(x)}" y="${f(base - bh)}" width="${f(Math.min(bw, r.x + r.w - x))}" height="${f(bh)}" fill="${color}" opacity="0.55"/>`;
      x += bw * (0.9 + rnd() * 0.3);
    }
    const mon = MONUMENTOS[i % MONUMENTOS.length]!;
    const h = alto * (mon.ancho > 1 ? 0.75 : 0.92 + rnd() * 0.08);
    const w = h * mon.ancho;
    if (x + w > r.x + r.w) break;
    out += mon.dibujo(x + w / 2, base, h, color, hueco);
    x += w + alto * (0.05 + rnd() * 0.1);
    i++;
  }
  return `${out}<rect x="${f(r.x)}" y="${f(base - alto * 0.015)}" width="${f(r.w)}" height="${f(alto * 0.015)}" fill="${color}"/>`;
}

// ---------------------------------------------------------------------------------------------
// Papelería de viaje
// ---------------------------------------------------------------------------------------------

/** Estampilla con borde dentado (los agujeritos van del color del papel) y un monumento adentro. */
function estampilla(x: number, y: number, w: number, h: number, giro: number, color: string, papel: string, blanco: string, monumento: Monumento): string {
  const r = Math.min(w, h) * 0.045;
  let o = `<g transform="rotate(${f(giro)} ${f(x + w / 2)} ${f(y + h / 2)})"><rect x="${f(x + w * 0.02)}" y="${f(y + h * 0.03)}" width="${f(w)}" height="${f(h)}" fill="#000000" opacity="0.08"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${blanco}"/>`;
  const nx = Math.max(4, Math.round(w / (r * 3)));
  const ny = Math.max(4, Math.round(h / (r * 3)));
  for (let i = 0; i <= nx; i++) o += `<circle cx="${f(x + (w * i) / nx)}" cy="${f(y)}" r="${f(r)}" fill="${papel}"/><circle cx="${f(x + (w * i) / nx)}" cy="${f(y + h)}" r="${f(r)}" fill="${papel}"/>`;
  for (let j = 1; j < ny; j++) o += `<circle cx="${f(x)}" cy="${f(y + (h * j) / ny)}" r="${f(r)}" fill="${papel}"/><circle cx="${f(x + w)}" cy="${f(y + (h * j) / ny)}" r="${f(r)}" fill="${papel}"/>`;
  const m = Math.min(w, h) * 0.12;
  o += `<rect x="${f(x + m)}" y="${f(y + m)}" width="${f(w - 2 * m)}" height="${f(h - 2 * m)}" fill="${color}"/>`;
  o += `<circle cx="${f(x + w * 0.66)}" cy="${f(y + h * 0.36)}" r="${f(w * 0.13)}" fill="${blanco}" opacity="0.35"/>`;
  o += monumento(x + w / 2, y + h - m * 1.6, (h - 2 * m) * 0.62, blanco, color);
  return `${o}</g>`;
}

/** Matasellos: dos aros y líneas onduladas que salen hacia un costado. */
function matasellos(cx: number, cy: number, r: number, color: string, giro: number, ondas = 5): string {
  let o = `<g transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})" stroke="${color}" fill="none" opacity="0.75"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke-width="${f(r * 0.05)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.72)}" stroke-width="${f(r * 0.03)}"/>`;
  o += `<line x1="${f(cx - r * 0.4)}" y1="${f(cy)}" x2="${f(cx + r * 0.4)}" y2="${f(cy)}" stroke-width="${f(r * 0.08)}"/>`;
  for (let i = 0; i < ondas; i++) {
    const y = cy - r * 0.8 + (i * r * 1.6) / (ondas - 1);
    const L = r * 1.1;
    o += `<path d="M ${f(cx + r * 1.15)} ${f(y)} q ${f(L / 4)} ${f(-r * 0.12)} ${f(L / 2)} 0 t ${f(L / 2)} 0 t ${f(L / 2)} 0 t ${f(L / 2)} 0" stroke-width="${f(r * 0.04)}"/>`;
  }
  return `${o}</g>`;
}

/** Sello de pasaporte de tinta: redondo, rectangular u ovalado, con renglones y un avioncito. */
function selloPasaporte(cx: number, cy: number, r: number, color: string, giro: number, forma: number): string {
  const sw = r * 0.06;
  let o = `<g transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})" stroke="${color}" fill="none" opacity="0.78" stroke-linecap="round">`;
  const avion = (x: number, y: number, s: number) =>
    `<path d="M ${f(x - s)} ${f(y)} L ${f(x + s)} ${f(y)} M ${f(x + s * 0.1)} ${f(y)} L ${f(x - s * 0.35)} ${f(y - s * 0.75)} M ${f(x + s * 0.1)} ${f(y)} L ${f(x - s * 0.35)} ${f(y + s * 0.75)} M ${f(x - s * 0.85)} ${f(y)} L ${f(x - s)} ${f(y - s * 0.35)}" stroke-width="${f(sw * 1.2)}"/>`;
  if (forma % 3 === 0) {
    o += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke-width="${f(sw * 1.4)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.78)}" stroke-width="${f(sw * 0.7)}"/>`;
    o += avion(cx, cy, r * 0.32);
    o += `<line x1="${f(cx - r * 0.45)}" y1="${f(cy - r * 0.5)}" x2="${f(cx + r * 0.45)}" y2="${f(cy - r * 0.5)}" stroke-width="${f(sw * 1.6)}"/><line x1="${f(cx - r * 0.35)}" y1="${f(cy + r * 0.5)}" x2="${f(cx + r * 0.35)}" y2="${f(cy + r * 0.5)}" stroke-width="${f(sw * 1.6)}"/>`;
  } else if (forma % 3 === 1) {
    const w = r * 2.1;
    const h = r * 1.3;
    o += `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(r * 0.12)}" stroke-width="${f(sw * 1.4)}"/><rect x="${f(cx - w / 2 + r * 0.12)}" y="${f(cy - h / 2 + r * 0.12)}" width="${f(w - r * 0.24)}" height="${f(h - r * 0.24)}" stroke-width="${f(sw * 0.6)}"/>`;
    o += `<line x1="${f(cx - w * 0.36)}" y1="${f(cy - h * 0.15)}" x2="${f(cx + w * 0.1)}" y2="${f(cy - h * 0.15)}" stroke-width="${f(sw * 2)}"/><line x1="${f(cx - w * 0.36)}" y1="${f(cy + h * 0.18)}" x2="${f(cx - w * 0.02)}" y2="${f(cy + h * 0.18)}" stroke-width="${f(sw * 1.4)}"/>`;
    o += avion(cx + w * 0.27, cy, r * 0.26);
  } else {
    o += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 1.2)}" ry="${f(r * 0.8)}" stroke-width="${f(sw * 1.4)}"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 0.98)}" ry="${f(r * 0.6)}" stroke-width="${f(sw * 0.6)}" stroke-dasharray="${f(r * 0.06)} ${f(r * 0.08)}"/>`;
    o += `<line x1="${f(cx - r * 0.6)}" y1="${f(cy)}" x2="${f(cx + r * 0.6)}" y2="${f(cy)}" stroke-width="${f(sw * 2.2)}"/>`;
    for (const sx of [-1, 1]) o += `<circle cx="${f(cx + sx * r * 0.8)}" cy="${f(cy)}" r="${f(r * 0.06)}" fill="${color}"/>`;
  }
  return `${o}</g>`;
}

/** Una fila de sellos de pasaporte repartidos a lo ancho de un área. */
function sellos(area: Rect, r: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  const paso = r * 3;
  const n = Math.max(1, Math.floor(area.w / paso));
  const sobra = area.w - n * paso;
  let out = "";
  for (let i = 0; i < n; i++) {
    const cx = area.x + sobra / 2 + paso * (i + 0.5) + (rnd() - 0.5) * r * 0.5;
    const cy = area.y + area.h / 2 + (rnd() - 0.5) * Math.max(0, area.h - 2.2 * r);
    out += selloPasaporte(cx, cy, r * (0.85 + rnd() * 0.25), colores[Math.floor(rnd() * colores.length)]!, (rnd() - 0.5) * 40, Math.floor(rnd() * 3));
  }
  return out;
}

/** Guilloché de pasaporte: ondas finas entrelazadas en una franja. */
function guilloche(r: Rect, color: string, lineas = 6): string {
  let out = "";
  for (let i = 0; i < lineas; i++) {
    const largo = r.h * (1.6 + i * 0.15);
    const fase = (i * largo) / lineas;
    let d = `M ${f(r.x - fase)} ${f(r.y + r.h / 2)}`;
    for (let x = r.x - fase; x < r.x + r.w; x += largo) d += ` q ${f(largo / 4)} ${f(-r.h / 2)} ${f(largo / 2)} 0 t ${f(largo / 2)} 0`;
    out += `<path d="${d}" stroke="${color}" stroke-width="0.2" fill="none"/>`;
  }
  return out;
}

/** Azulejo cuadrado: cuartos de círculo en las puntas (arman rosetas al juntarse) y flor al centro. */
function azulejo(x: number, y: number, t: number, azul: string, blanco: string, claro: string): string {
  let o = `<rect x="${f(x)}" y="${f(y)}" width="${f(t)}" height="${f(t)}" fill="${blanco}"/>`;
  const q = t * 0.3;
  for (const [px, py, a] of [
    [x, y, 0],
    [x + t, y, 90],
    [x + t, y + t, 180],
    [x, y + t, 270],
  ] as const) {
    o += `<g transform="translate(${f(px)} ${f(py)}) rotate(${a})"><path d="M 0 0 L ${f(q)} 0 A ${f(q)} ${f(q)} 0 0 1 0 ${f(q)} Z" fill="${azul}"/><path d="M ${f(q * 1.25)} 0 A ${f(q * 1.25)} ${f(q * 1.25)} 0 0 1 0 ${f(q * 1.25)}" stroke="${azul}" stroke-width="${f(t * 0.02)}" fill="none"/></g>`;
  }
  const cx = x + t / 2;
  const cy = y + t / 2;
  for (let i = 0; i < 4; i++) o += `<ellipse cx="${f(cx)}" cy="${f(cy - t * 0.14)}" rx="${f(t * 0.07)}" ry="${f(t * 0.14)}" fill="${azul}" transform="rotate(${i * 90 + 45} ${f(cx)} ${f(cy)})"/>`;
  for (let i = 0; i < 4; i++) o += `<circle cx="${f(cx + Math.cos((i * Math.PI) / 2) * t * 0.27)}" cy="${f(cy + Math.sin((i * Math.PI) / 2) * t * 0.27)}" r="${f(t * 0.035)}" fill="${azul}"/>`;
  return o + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(t * 0.07)}" fill="${claro}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(t * 0.03)}" fill="${azul}"/>`;
}

/** Una tira de azulejos que llena un rectángulo (vertical u horizontal), con la junta marcada. */
function tiraAzulejos(r: Rect, azul: string, blanco: string, claro: string, vertical: boolean): string {
  const lado = vertical ? r.w : r.h;
  const largo = vertical ? r.h : r.w;
  const n = Math.max(1, Math.round(largo / lado));
  const paso = largo / n;
  let out = `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="${blanco}"/>`;
  for (let i = 0; i < n; i++) {
    // El azulejo es cuadrado; si sobra un poco, se centra en su casilla.
    const x = vertical ? r.x : r.x + i * paso + (paso - lado) / 2;
    const y = vertical ? r.y + i * paso + (paso - lado) / 2 : r.y;
    out += azulejo(x, y, lado, azul, blanco, claro);
  }
  return out + `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="none" stroke="${azul}" stroke-width="0.5"/>`;
}

/** Rosa de los vientos de ocho puntas. */
function rosaVientos(cx: number, cy: number, r: number, oscuro: string, claro: string): string {
  let o = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.78)}" fill="none" stroke="${oscuro}" stroke-width="${f(r * 0.015)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.7)}" fill="none" stroke="${oscuro}" stroke-width="${f(r * 0.008)}" stroke-dasharray="${f(r * 0.03)} ${f(r * 0.03)}"/>`;
  for (let i = 0; i < 8; i++) {
    const L = i % 2 === 0 ? r : r * 0.55;
    const a = (i * 45 * Math.PI) / 180 - Math.PI / 2;
    const ax = cx + Math.cos(a) * L;
    const ay = cy + Math.sin(a) * L;
    const b = r * (i % 2 === 0 ? 0.12 : 0.09);
    const lx = cx + Math.cos(a - Math.PI / 2) * b;
    const ly = cy + Math.sin(a - Math.PI / 2) * b;
    const rx = cx + Math.cos(a + Math.PI / 2) * b;
    const ry = cy + Math.sin(a + Math.PI / 2) * b;
    o += `<path d="M ${f(cx)} ${f(cy)} L ${f(lx)} ${f(ly)} L ${f(ax)} ${f(ay)} Z" fill="${oscuro}"/><path d="M ${f(cx)} ${f(cy)} L ${f(rx)} ${f(ry)} L ${f(ax)} ${f(ay)} Z" fill="${claro}" stroke="${oscuro}" stroke-width="${f(r * 0.008)}"/>`;
  }
  return o + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.05)}" fill="${oscuro}"/>`;
}

/** Marcador de mapa (gota) con su punto blanco. */
const pin = (x: number, y: number, s: number, color: string) =>
  `<path d="M ${f(x)} ${f(y)} C ${f(x - s * 0.15)} ${f(y - s * 0.4)} ${f(x - s * 0.5)} ${f(y - s * 0.6)} ${f(x - s * 0.5)} ${f(y - s)} A ${f(s * 0.5)} ${f(s * 0.5)} 0 1 1 ${f(x + s * 0.5)} ${f(y - s)} C ${f(x + s * 0.5)} ${f(y - s * 0.6)} ${f(x + s * 0.15)} ${f(y - s * 0.4)} ${f(x)} ${f(y)} Z" fill="${color}"/><circle cx="${f(x)}" cy="${f(y - s)}" r="${f(s * 0.2)}" fill="#fffaf0"/>`;

/** Recorrido punteado con marcadores, ondulando dentro de una franja. */
function ruta(area: Rect, color: string, pinColor: string, semilla: number, paradas: number, tamPin: number): string {
  const rnd = azar(semilla);
  const pts: [number, number][] = [];
  for (let i = 0; i < paradas; i++) {
    const x = area.x + area.w * ((i + 0.5) / paradas) + (rnd() - 0.5) * (area.w / paradas) * 0.3;
    const y = area.y + tamPin * 1.5 + rnd() * Math.max(0, area.h - tamPin * 1.5);
    pts.push([x, y]);
  }
  let d = `M ${f(area.x)} ${f(pts[0]![1])}`;
  for (const [x, y] of pts) d += ` T ${f(x)} ${f(y)}`;
  d += ` T ${f(area.x + area.w)} ${f(pts[pts.length - 1]![1])}`;
  let o = `<path d="${d}" stroke="${color}" stroke-width="${f(tamPin * 0.06)}" fill="none" stroke-dasharray="${f(tamPin * 0.25)} ${f(tamPin * 0.2)}" stroke-linecap="round"/>`;
  for (const [x, y] of pts) o += pin(x, y, tamPin, pinColor);
  return o;
}

/** Retícula de mapa antiguo: meridianos y paralelos apenas curvos. */
function reticula(m: Medidas, paso: number, color: string): string {
  let o = "";
  for (let x = paso / 2; x < m.anchoMm; x += paso) o += `<path d="M ${f(x)} 0 Q ${f(x + (x - m.anchoMm / 2) * 0.06)} ${f(m.altoMm / 2)} ${f(x)} ${f(m.altoMm)}" stroke="${color}" stroke-width="0.2" fill="none"/>`;
  for (let y = paso / 2; y < m.altoMm; y += paso) o += `<path d="M 0 ${f(y)} Q ${f(m.anchoMm / 2)} ${f(y - paso * 0.25)} ${f(m.anchoMm)} ${f(y)}" stroke="${color}" stroke-width="0.2" fill="none"/>`;
  return o;
}

/** Código de barras de boleto: barritas de ancho al azar. */
function codigoBarras(x: number, y: number, w: number, h: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let o = "";
  for (let px = x; px < x + w; ) {
    const b = w * (0.008 + rnd() * 0.025);
    if (rnd() > 0.35) o += `<rect x="${f(px)}" y="${f(y)}" width="${f(Math.min(b, x + w - px))}" height="${f(h)}" fill="${color}"/>`;
    px += b + w * 0.012;
  }
  return o;
}

/** Casitas blancas de las islas griegas, con cúpulas azules y buganvilias, sobre el pie de `r`. */
function casasGriegas(r: Rect, alto: number, semilla: number, azul: string): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  let out = "";
  for (const fila of [0, 1]) {
    let x = r.x;
    while (x < r.x + r.w) {
      const w = Math.min(alto * (0.32 + rnd() * 0.3), r.x + r.w - x);
      if (w < alto * 0.1) break;
      const h = alto * (fila === 0 ? 0.55 + rnd() * 0.3 : 0.3 + rnd() * 0.25);
      const y = base - h;
      out += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fila === 0 ? "#f2f6fa" : "#ffffff"}" stroke="#c7d5e2" stroke-width="0.3"/>`;
      out += `<rect x="${f(x + w * 0.78)}" y="${f(y)}" width="${f(w * 0.22)}" height="${f(h)}" fill="#dfe8f1" opacity="${fila === 0 ? 0.8 : 0.6}"/>`;
      if (fila === 0 && rnd() > 0.45) {
        // Cúpula con su linterna.
        const cr = Math.min(w * 0.32, alto * 0.13);
        const cx = x + w * (0.3 + rnd() * 0.3);
        out += `<rect x="${f(cx - cr)}" y="${f(y - cr * 0.3)}" width="${f(cr * 2)}" height="${f(cr * 0.3)}" fill="#ffffff" stroke="#c7d5e2" stroke-width="0.3"/><path d="M ${f(cx - cr)} ${f(y - cr * 0.3)} A ${f(cr)} ${f(cr)} 0 0 1 ${f(cx + cr)} ${f(y - cr * 0.3)} Z" fill="${azul}"/><rect x="${f(cx - cr * 0.07)}" y="${f(y - cr * 1.6)}" width="${f(cr * 0.14)}" height="${f(cr * 0.35)}" fill="${azul}"/>`;
      }
      // Puerta y ventana azules.
      out += `<path d="M ${f(x + w * 0.2)} ${f(base)} L ${f(x + w * 0.2)} ${f(base - h * 0.32)} A ${f(w * 0.08)} ${f(w * 0.08)} 0 0 1 ${f(x + w * 0.36)} ${f(base - h * 0.32)} L ${f(x + w * 0.36)} ${f(base)} Z" fill="${azul}" opacity="${fila === 0 ? 0.7 : 1}"/>`;
      out += `<rect x="${f(x + w * 0.52)}" y="${f(y + h * 0.3)}" width="${f(w * 0.14)}" height="${f(h * 0.18)}" fill="${azul}" opacity="${fila === 0 ? 0.6 : 0.9}"/>`;
      if (fila === 1 && rnd() > 0.55) {
        for (let k = 0; k < 9; k++) out += `<circle cx="${f(Math.min(r.x + r.w, x + w * 0.92 + (rnd() - 0.5) * w * 0.25))}" cy="${f(y + rnd() * h * 0.5)}" r="${f(alto * 0.025 * (0.6 + rnd()))}" fill="${rnd() > 0.3 ? "#d6457a" : "#e98bb0"}"/>`;
      }
      x += w + (fila === 0 ? alto * 0.04 : alto * 0.005);
    }
  }
  return out;
}

/** Toldo a rayas de bistró con el borde festoneado, colgando desde arriba de un área. */
function toldo(r: Rect, ancho: number, c1: string, c2: string, varilla: string): string {
  const n = Math.max(2, Math.round(r.w / ancho));
  const a = r.w / n;
  let o = "";
  for (let i = 0; i < n; i++) {
    const x = r.x + i * a;
    o += `<path d="M ${f(x)} ${f(r.y)} L ${f(x + a)} ${f(r.y)} L ${f(x + a)} ${f(r.y + r.h)} A ${f(a / 2)} ${f(a * 0.35)} 0 0 1 ${f(x)} ${f(r.y + r.h)} Z" fill="${i % 2 ? c2 : c1}"/>`;
  }
  return o + `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(Math.max(0.8, r.h * 0.06))}" fill="${varilla}"/>`;
}

/** Ciprés toscano: una llama alta y angosta. */
const cipres = (x: number, base: number, h: number, color: string) =>
  `<path d="M ${f(x)} ${f(base - h)} C ${f(x + h * 0.11)} ${f(base - h * 0.7)} ${f(x + h * 0.1)} ${f(base - h * 0.2)} ${f(x + h * 0.03)} ${f(base)} L ${f(x - h * 0.03)} ${f(base)} C ${f(x - h * 0.1)} ${f(base - h * 0.2)} ${f(x - h * 0.11)} ${f(base - h * 0.7)} ${f(x)} ${f(base - h)} Z" fill="${color}"/>`;

/** Lomas suaves que se superponen desde el pie de `r`. */
function lomas(r: Rect, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  return colores
    .map((c, i) => {
      const y0 = base - alto * (1 - i * 0.3);
      const tramos = 2 + i;
      const largo = r.w / tramos;
      let d = `M ${f(r.x)} ${f(base)} L ${f(r.x)} ${f(y0 + alto * 0.15)}`;
      for (let k = 0; k < tramos; k++) d += ` Q ${f(r.x + largo * (k + 0.5))} ${f(y0 - alto * (0.15 + rnd() * 0.25))} ${f(r.x + largo * (k + 1))} ${f(y0 + alto * (rnd() * 0.25))}`;
      return `<path d="${d} L ${f(r.x + r.w)} ${f(base)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Casa de canal holandesa: angosta, con frontón escalonado, de campana o en punta. */
function casaCanal(x: number, base: number, w: number, h: number, color: string, tipo: number, blanco: string): string {
  const cuerpo = h * 0.78;
  const top = base - cuerpo;
  let o = `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(cuerpo)}" fill="${color}"/>`;
  const g = h - cuerpo;
  if (tipo % 3 === 0) {
    // Escalonado.
    const e = w / 6;
    o += `<path d="M ${f(x)} ${f(top)} L ${f(x)} ${f(top - g * 0.33)} L ${f(x + e)} ${f(top - g * 0.33)} L ${f(x + e)} ${f(top - g * 0.66)} L ${f(x + 2 * e)} ${f(top - g * 0.66)} L ${f(x + 2 * e)} ${f(top - g)} L ${f(x + 4 * e)} ${f(top - g)} L ${f(x + 4 * e)} ${f(top - g * 0.66)} L ${f(x + 5 * e)} ${f(top - g * 0.66)} L ${f(x + 5 * e)} ${f(top - g * 0.33)} L ${f(x + w)} ${f(top - g * 0.33)} L ${f(x + w)} ${f(top)} Z" fill="${color}"/>`;
  } else if (tipo % 3 === 1) {
    // Campana.
    o += `<path d="M ${f(x)} ${f(top)} C ${f(x + w * 0.2)} ${f(top)} ${f(x + w * 0.25)} ${f(top - g * 0.6)} ${f(x + w * 0.3)} ${f(top - g)} L ${f(x + w * 0.7)} ${f(top - g)} C ${f(x + w * 0.75)} ${f(top - g * 0.6)} ${f(x + w * 0.8)} ${f(top)} ${f(x + w)} ${f(top)} Z" fill="${color}"/>`;
  } else {
    o += `<path d="M ${f(x)} ${f(top)} L ${f(x + w / 2)} ${f(top - g)} L ${f(x + w)} ${f(top)} Z" fill="${color}"/>`;
  }
  o += `<rect x="${f(x + w * 0.42)}" y="${f(top - g * 0.55)}" width="${f(w * 0.16)}" height="${f(g * 0.35)}" fill="${blanco}"/>`;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 2; i++) {
      o += `<rect x="${f(x + w * (0.18 + i * 0.4))}" y="${f(top + cuerpo * (0.08 + j * 0.24))}" width="${f(w * 0.24)}" height="${f(cuerpo * 0.15)}" fill="${blanco}"/>`;
    }
  }
  return o + `<rect x="${f(x + w * 0.36)}" y="${f(base - cuerpo * 0.2)}" width="${f(w * 0.28)}" height="${f(cuerpo * 0.2)}" fill="#2e4a62"/>`;
}

/** Una fila de casas de canal sobre el pie de `r`. */
function filaCasas(r: Rect, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  let x = r.x;
  let i = 0;
  while (x < r.x + r.w - alto * 0.15) {
    const w = Math.min(alto * (0.32 + rnd() * 0.14), r.x + r.w - x);
    const h = alto * (0.78 + rnd() * 0.22);
    out += casaCanal(x, r.y + r.h, w, h, colores[Math.floor(rnd() * colores.length)]!, i + Math.floor(rnd() * 3), "#fbf7ee");
    x += w + alto * 0.01;
    i++;
  }
  return out;
}

/** Agua de canal con reflejos en líneas cortas. */
function canal(r: Rect, color: string, reflejo: string, semilla: number): string {
  const rnd = azar(semilla);
  let o = `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="${color}"/>`;
  const n = Math.round(r.w / Math.max(4, r.h * 0.5));
  for (let i = 0; i < n; i++) {
    const x = r.x + rnd() * r.w;
    const y = r.y + r.h * (0.2 + rnd() * 0.65);
    o += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(Math.min(r.x + r.w, x + r.h * (0.3 + rnd() * 0.6)))}" y2="${f(y)}" stroke="${reflejo}" stroke-width="${f(r.h * 0.04)}" stroke-linecap="round" opacity="0.7"/>`;
  }
  return o;
}

/** Tulipán: tallo, dos hojas y la flor de tres pétalos. */
function tulipan(x: number, base: number, h: number, color: string, verde: string): string {
  const fw = h * 0.24;
  const fy = base - h;
  return `<path d="M ${f(x)} ${f(base)} L ${f(x)} ${f(fy + fw * 0.6)}" stroke="${verde}" stroke-width="${f(h * 0.04)}"/><path d="M ${f(x)} ${f(base)} Q ${f(x - h * 0.25)} ${f(base - h * 0.35)} ${f(x - h * 0.12)} ${f(base - h * 0.6)} Q ${f(x - h * 0.05)} ${f(base - h * 0.3)} ${f(x)} ${f(base)} Z" fill="${verde}"/><path d="M ${f(x)} ${f(base)} Q ${f(x + h * 0.22)} ${f(base - h * 0.3)} ${f(x + h * 0.12)} ${f(base - h * 0.5)} Q ${f(x + h * 0.04)} ${f(base - h * 0.25)} ${f(x)} ${f(base)} Z" fill="${verde}"/><path d="M ${f(x - fw / 2)} ${f(fy)} L ${f(x - fw / 4)} ${f(fy + fw * 0.25)} L ${f(x)} ${f(fy - fw * 0.1)} L ${f(x + fw / 4)} ${f(fy + fw * 0.25)} L ${f(x + fw / 2)} ${f(fy)} Q ${f(x + fw / 2)} ${f(fy + fw * 0.9)} ${f(x)} ${f(fy + fw * 0.9)} Q ${f(x - fw / 2)} ${f(fy + fw * 0.9)} ${f(x - fw / 2)} ${f(fy)} Z" fill="${color}"/>`;
}

/** Borde de sobre de correo aéreo: rayas diagonales rojas y azules en un marco. */
function bordeAereo(id: string, r: Rect, grosor: number, rojo: string, azul: string): { defs: string; cuerpo: string } {
  const p = grosor * 2.6;
  return {
    defs: `<pattern id="${id}" width="${f(p)}" height="${f(p)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${f(p)}" height="${f(p)}" fill="#fbf6ea"/><rect width="${f(p * 0.25)}" height="${f(p)}" fill="${rojo}"/><rect x="${f(p * 0.5)}" width="${f(p * 0.25)}" height="${f(p)}" fill="${azul}"/></pattern>`,
    cuerpo: `<path d="M ${f(r.x)} ${f(r.y)} h ${f(r.w)} v ${f(r.h)} h ${f(-r.w)} Z M ${f(r.x + grosor)} ${f(r.y + grosor)} v ${f(r.h - 2 * grosor)} h ${f(r.w - 2 * grosor)} v ${f(-(r.h - 2 * grosor))} Z" fill="url(#${id})" fill-rule="evenodd"/>`,
  };
}

// ---------------------------------------------------------------------------------------------

export const EUROPA: EstiloFotolibro[] = [
  {
    id: "europa-01-postal-vintage",
    tema: "europa",
    nombre: "Postal vintage",
    descripcion: "Papel sepia, borde de correo aéreo, estampillas dentadas y matasellos: el viaje contado como una postal.",
    papel: "#efe3c8",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const papel = degradado("pv", total(m), "#f3e8cf", "#e6d5b2");
      const g = grano("pg", m, 0.14, 1);
      const b = s * 0.028;
      let c = papel.cuerpo;
      let defs = papel.defs + g.defs;
      const borde = (id: string, r: Rect) => {
        const x = bordeAereo(id, r, b, "#b23a3a", "#2a4d7f");
        defs += x.defs;
        c += x.cuerpo;
      };
      if (tipo === "interior") {
        // Sólo dos tiras arriba y abajo, de lado a lado.
        borde("ba", { x: -b, y: 0, w: m.anchoMm + 2 * b, h: m.altoMm });
      } else if (tipo === "interior-alt") {
        borde("ba", total(m));
        c += matasellos(der.x + der.w - s * 0.24, s * 0.12, s * 0.05, "#4a3726", -8, 4);
      } else {
        borde("ba", izq);
        borde("bb", der);
      }
      const ew = s * 0.17;
      const eh = s * 0.21;
      if (tipo === "apertura") {
        c += estampilla(izq.x + izq.w - b - s * 0.05 - ew, b + s * 0.05, ew, eh, 4, "#3f6e8c", "#efe3c8", "#fbf6ea", torre);
        c += matasellos(izq.x + izq.w - b - s * 0.05 - ew * 1.05, b + s * 0.05 + eh * 0.85, s * 0.06, "#4a3726", -12, 5);
      }
      if (tipo === "cierre") {
        c += estampilla(der.x + der.w - b - s * 0.05 - ew, b + s * 0.05, ew, eh, -3, "#a0522d", "#efe3c8", "#fbf6ea", coliseo);
        c += estampilla(der.x + der.w - b - s * 0.09 - ew * 1.9, b + s * 0.06, ew * 0.8, eh * 0.8, 6, "#5b7f4a", "#efe3c8", "#fbf6ea", molino);
        c += matasellos(der.x + der.w - b - s * 0.06 - ew * 1.3, b + s * 0.05 + eh * 0.9, s * 0.06, "#4a3726", 10, 5);
      }
      return svg(m, c + g.cuerpo, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const b = menos(s * 0.028, 14) + 5;
      if (tipo === "interior") return { arriba: b, abajo: b };
      if (tipo === "interior-alt") return lado === "der" ? { arriba: menos(s * 0.19, 14) + 2, abajo: b, exterior: b } : { arriba: b, abajo: b, exterior: b };
      // En el cierre, la frase y las estampillas ocupan la cabeza de la página derecha.
      if (tipo === "cierre" && lado === "der") return { arriba: s * 0.028 + s * 0.05 + s * 0.21 * 1.25 + 4, abajo: b, exterior: b, interior: b };
      return { arriba: b, abajo: b, exterior: b, interior: b };
    }),
    textos: (tipo, m) => {
      const s = corto(m);
      const ts = textosClasicos({
        titulo: "Homemade Apple",
        texto: "Libre Baskerville",
        color: "#4a3726",
        acento: "#8a3b2e",
        ejemplos: { titulo: "Nuestro viaje por Europa", subtitulo: "París · Roma · Barcelona", fecha: "Mayo 2026", frase: "Hasta la próxima aventura" },
        escalaTitulo: 0.075,
      })(tipo, m);
      // En el cierre la frase se escribe a la izquierda, como el mensaje de una postal.
      if (tipo === "cierre") return correr(ts, { der: s * 0.17 * 1.9 + s * 0.06 }).map((t) => ({ ...t, alineacion: "left" as const }));
      return tipo === "apertura" ? correr(ts, { dy: s * 0.06 }) : ts;
    },
  },
  {
    id: "europa-02-pasaporte",
    tema: "europa",
    nombre: "Pasaporte sellado",
    descripcion: "Tapa azul con escudo dorado y páginas de visado llenas de sellos de colores. Para los que coleccionan países.",
    papel: "#f4f1ea",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const banda = s * 0.2;
      const colores = ["#b23a48", "#2d6a9f", "#3a7d44", "#6b4c9a", "#c46d1e"];
      const r = s * 0.065;
      let c = fondoLiso(total(m), "#f4f1ea");
      c += guilloche({ x: 0, y: s * 0.02, w: m.anchoMm, h: banda * 0.5 }, "#c9d6df") + guilloche({ x: 0, y: m.altoMm - s * 0.02 - banda * 0.5, w: m.anchoMm, h: banda * 0.5 }, "#c9d6df");
      const arriba = (p: Rect, sem: number) => sellos({ x: p.x + s * 0.04, y: s * 0.02, w: p.w - s * 0.08, h: banda }, r, colores, sem);
      const abajo = (p: Rect, sem: number) => sellos({ x: p.x + s * 0.04, y: m.altoMm - s * 0.02 - banda, w: p.w - s * 0.08, h: banda }, r, colores, sem);
      if (tipo === "interior") c += arriba(izq, 1) + arriba(der, 2);
      else if (tipo === "interior-alt") c += abajo(izq, 3) + abajo(der, 4);
      else if (tipo === "apertura") c += arriba(der, 5) + abajo(der, 6);
      else c += arriba(izq, 7) + abajo(der, 8);
      if (tipo === "apertura") {
        // La tapa del pasaporte: azul con un escudo de globo en dorado.
        c += fondoLiso(izq, "#1c2b4a");
        const gx = izq.x + izq.w / 2;
        const gy = m.altoMm * 0.17;
        const gr = Math.min(s * 0.075, m.altoMm * 0.08);
        c += `<g stroke="#d4b46a" fill="none" stroke-width="${f(gr * 0.04)}"><circle cx="${f(gx)}" cy="${f(gy)}" r="${f(gr)}"/><ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(gr * 0.45)}" ry="${f(gr)}"/><line x1="${f(gx)}" y1="${f(gy - gr)}" x2="${f(gx)}" y2="${f(gy + gr)}"/><line x1="${f(gx - gr)}" y1="${f(gy)}" x2="${f(gx + gr)}" y2="${f(gy)}"/><path d="M ${f(gx - gr * 0.87)} ${f(gy - gr * 0.5)} Q ${f(gx)} ${f(gy - gr * 0.62)} ${f(gx + gr * 0.87)} ${f(gy - gr * 0.5)} M ${f(gx - gr * 0.87)} ${f(gy + gr * 0.5)} Q ${f(gx)} ${f(gy + gr * 0.38)} ${f(gx + gr * 0.87)} ${f(gy + gr * 0.5)}"/></g>`;
        c += `<rect x="${f(izq.x + izq.w * 0.06)}" y="${f(m.altoMm * 0.04)}" width="${f(izq.w * 0.88)}" height="${f(m.altoMm * 0.92)}" fill="none" stroke="#d4b46a" stroke-width="0.35" opacity="0.6"/>`;
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const b = menos(s * 0.22, 14) + 2;
      if (tipo === "interior") return { arriba: b };
      if (tipo === "interior-alt") return { abajo: b };
      if (tipo === "apertura") return lado === "der" ? { arriba: b, abajo: b } : {};
      return lado === "izq" ? { arriba: b } : { abajo: b * 0.6 };
    }),
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Playfair Display",
        texto: "DM Sans",
        color: tipo === "apertura" ? "#d4b46a" : "#1c2b4a",
        acento: tipo === "apertura" ? "#e9dcb4" : "#b23a48",
        ejemplos: { titulo: "Europa 2026", subtitulo: "Diario de viaje", fecha: "Abril – Mayo 2026", frase: "Sellos que cuentan historias" },
        escalaTitulo: 0.1,
      })(tipo, m),
  },
  {
    id: "europa-03-siluetas",
    tema: "europa",
    nombre: "Siluetas de Europa",
    descripcion: "Torres, cúpulas, templos y molinos en una línea de horizonte de tinta. Un viaje por varias ciudades en un solo libro.",
    papel: "#f7f3ec",
    margenMm: 14,
    fondo: (tipo, m) => {
      const s = corto(m);
      const alto = m.altoMm * (fuerte(tipo) ? 0.24 : 0.14);
      const g = grano("sg", m, 0.05);
      let c = fondoLiso(total(m), "#f7f3ec");
      const r = { x: m.anchoMm * 0.03, y: 0, w: m.anchoMm * 0.94, h: m.altoMm * 0.95 };
      if (tipo === "interior-alt") {
        c += `<circle cx="${f(m.anchoMm * 0.78)}" cy="${f(r.h - alto * 0.75)}" r="${f(alto * 0.4)}" fill="#e9c46a" opacity="0.55"/>`;
        c += horizonte(r, alto, "#8d99ae", "#f7f3ec", 9, 3);
      } else if (tipo === "interior") {
        c += horizonte(r, alto, "#8d99ae", "#f7f3ec", 5, 0);
      } else {
        c += `<circle cx="${f(tipo === "apertura" ? m.anchoMm * 0.72 : m.anchoMm * 0.28)}" cy="${f(r.h - alto * 0.8)}" r="${f(alto * 0.35)}" fill="#e9c46a" opacity="0.6"/>`;
        c += horizonte(r, alto, "#2d3142", "#f7f3ec", tipo === "apertura" ? 2 : 7, tipo === "apertura" ? 0 : 2);
      }
      c += `<line x1="${f(m.anchoMm * 0.03)}" y1="${f(m.altoMm * 0.95 + s * 0.012)}" x2="${f(m.anchoMm * 0.97)}" y2="${f(m.altoMm * 0.95 + s * 0.012)}" stroke="#c9a227" stroke-width="0.35"/>`;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const alto = m.altoMm * (fuerte(tipo) ? 0.24 : 0.14);
      return { abajo: menos(m.altoMm * 0.05 + alto * (deTitulo(tipo, lado) ? 0.55 : 1), 14) + 3 };
    }, "arriba"),
    textos: textosClasicos({
      titulo: "Playfair Display",
      texto: "Montserrat",
      color: "#2d3142",
      acento: "#b08a1e",
      ejemplos: { titulo: "París & Roma", subtitulo: "Nuestro viaje por Europa", fecha: "Septiembre 2026", frase: "El mundo es un libro" },
      escalaTitulo: 0.1,
      posicion: "arriba",
    }),
  },
  {
    id: "europa-04-azulejos",
    tema: "europa",
    nombre: "Azulejos",
    descripcion: "Guardas de azulejos azul cobalto sobre blanco, como en Lisboa, Sevilla o Barcelona. Fresco y mediterráneo.",
    papel: "#fbfaf7",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const azul = "#1f4e9c";
      const blanco = "#fbfaf7";
      const claro = "#9db8e0";
      const t = s * (fuerte(tipo) ? 0.15 : 0.11);
      let c = fondoLiso(total(m), blanco);
      if (tipo === "interior-alt") {
        c += tiraAzulejos({ x: 0, y: m.altoMm - t, w: m.anchoMm, h: t }, azul, blanco, claro, false);
        c += `<line x1="0" y1="${f(m.altoMm - t * 1.18)}" x2="${f(m.anchoMm)}" y2="${f(m.altoMm - t * 1.18)}" stroke="${azul}" stroke-width="0.6"/><line x1="0" y1="${f(s * 0.04)}" x2="${f(m.anchoMm)}" y2="${f(s * 0.04)}" stroke="${azul}" stroke-width="0.4"/>`;
      } else {
        c += tiraAzulejos({ x: izq.x, y: 0, w: t, h: m.altoMm }, azul, blanco, claro, true);
        c += tiraAzulejos({ x: der.x + der.w - t, y: 0, w: t, h: m.altoMm }, azul, blanco, claro, true);
        c += `<line x1="${f(t * 1.18)}" y1="0" x2="${f(t * 1.18)}" y2="${f(m.altoMm)}" stroke="${azul}" stroke-width="0.6"/><line x1="${f(m.anchoMm - t * 1.18)}" y1="0" x2="${f(m.anchoMm - t * 1.18)}" y2="${f(m.altoMm)}" stroke="${azul}" stroke-width="0.6"/>`;
      }
      if (tipo === "apertura") {
        const a = s * 0.08;
        c += azulejo(izq.x + (izq.w + t * 0.9) / 2 - a / 2, m.altoMm * 0.13, a, azul, blanco, claro);
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, _lado, m) => {
      const s = corto(m);
      const t = s * (fuerte(tipo) ? 0.15 : 0.11);
      if (tipo === "interior-alt") return { abajo: menos(t * 1.18, 12) + 4, arriba: menos(s * 0.04, 12) + 2 };
      return { exterior: menos(t * 1.18, 12) + 4 };
    }),
    textos: (tipo, m) => {
      const t = corto(m) * 0.15;
      const ts = textosClasicos({
        titulo: "Lora",
        texto: "Raleway",
        color: "#1f4e9c",
        acento: "#4d74b8",
        ejemplos: { titulo: "Barcelona & Lisboa", subtitulo: "Viaje por la península", fecha: "Octubre 2026", frase: "Volveremos" },
        escalaTitulo: 0.09,
      })(tipo, m);
      return correr(ts, tipo === "apertura" ? { izq: t * 0.9 } : { der: t * 0.9 });
    },
  },
  {
    id: "europa-05-mapa-ruta",
    tema: "europa",
    nombre: "Mapa de ruta",
    descripcion: "Papel de mapa antiguo con retícula, recorrido punteado de ciudad en ciudad y rosa de los vientos.",
    papel: "#efe6d2",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const vineta = `<radialGradient id="vi" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#efe6d2" stop-opacity="0"/><stop offset="1" stop-color="#b89a68" stop-opacity="0.45"/></radialGradient>`;
      const g = grano("mg", m, 0.12, 0.8);
      const franja = m.altoMm * 0.13;
      const tamPin = s * 0.045;
      let c = fondoLiso(total(m), "#efe6d2") + reticula(m, s * 0.14, "#cbb48a");
      const paradas = Math.max(3, Math.round(m.anchoMm / (s * 0.45)));
      if (tipo === "interior-alt") c += ruta({ x: 0, y: m.altoMm - franja - s * 0.02, w: m.anchoMm, h: franja }, "#7a5c3e", "#b5442f", 4, paradas, tamPin);
      else if (tipo === "apertura") c += ruta({ x: der.x, y: s * 0.02, w: der.w, h: franja }, "#7a5c3e", "#b5442f", 6, Math.max(2, Math.round(paradas / 2)), tamPin);
      else c += ruta({ x: 0, y: s * 0.02, w: m.anchoMm, h: franja }, "#7a5c3e", "#b5442f", tipo === "interior" ? 2 : 7, paradas, tamPin);
      const rr = Math.min(s * 0.11, m.altoMm * 0.12);
      // En la apertura, la rosa de los vientos corona el título.
      if (tipo === "apertura") c += rosaVientos(izq.x + izq.w / 2, m.altoMm * 0.15, Math.min(s * 0.09, m.altoMm * 0.11), "#5a4632", "#efe6d2");
      if (tipo === "cierre") c += rosaVientos(der.x + der.w / 2, m.altoMm * 0.84, rr, "#5a4632", "#efe6d2");
      c += `<rect width="${f(m.anchoMm)}" height="${f(m.altoMm)}" fill="url(#vi)"/>`;
      return svg(m, c + g.cuerpo, vineta + g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const b = menos(m.altoMm * 0.13 + s * 0.02, 14) + 3;
      // En las páginas del título, la rosa de los vientos ocupa el pie.
      const rosa = m.altoMm * 0.16 + Math.min(s * 0.11, m.altoMm * 0.12);
      if (tipo === "apertura" && lado === "izq") return {};
      if (deTitulo(tipo, lado)) return { abajo: menos(rosa, 14) + 2 };
      return tipo === "interior-alt" ? { abajo: b } : { arriba: b };
    }),
    textos: (tipo, m) => {
      const ts = textosClasicos({
        titulo: "Crimson Text",
        texto: "Work Sans",
        color: "#3b2f2a",
        acento: "#b5442f",
        ejemplos: { titulo: "Ruta por Europa", subtitulo: "Madrid · París · Ámsterdam", fecha: "Junio 2026", frase: "Todo viaje empieza con un mapa" },
        escalaTitulo: 0.1,
      })(tipo, m);
      // La frase del cierre baja un poco para dejar pasar la ruta.
      if (tipo === "cierre") return correr(ts, { dy: m.altoMm * 0.08 }).map((t) => ({ ...t, italica: true }));
      return ts.map((t) => (t.rol === "titulo" ? { ...t, italica: true } : t));
    },
  },
  {
    id: "europa-06-boleto-tren",
    tema: "europa",
    nombre: "Boleto de tren",
    descripcion: "Rayas de colores, troquelado y código de barras: el libro arma un pasaje de tren por Europa.",
    papel: "#f5f2ec",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const H = m.altoMm;
      const raya = H * 0.022;
      const rayas = (x: number, w: number, y: number) =>
        `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(raya * 1.6)}" fill="#d1495b"/><rect x="${f(x)}" y="${f(y + raya * 1.9)}" width="${f(w)}" height="${f(raya * 0.6)}" fill="#edae49"/><rect x="${f(x)}" y="${f(y + raya * 2.8)}" width="${f(w)}" height="${f(raya * 0.6)}" fill="#00798c"/>`;
      // Panel tipo talón de boleto, con muescas redondas a los costados.
      const talon = (p: Rect, y: number, h: number) => {
        const x = p.x + p.w * 0.07;
        const w = p.w * 0.86;
        const r = Math.min(h * 0.14, s * 0.03);
        return `<path d="M ${f(x)} ${f(y)} H ${f(x + w)} V ${f(y + h / 2 - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(x + w)} ${f(y + h / 2 + r)} V ${f(y + h)} H ${f(x)} V ${f(y + h / 2 + r)} A ${f(r)} ${f(r)} 0 0 0 ${f(x)} ${f(y + h / 2 - r)} Z" fill="#00798c"/><rect x="${f(x + r * 1.4)}" y="${f(y + h * 0.06)}" width="${f(w - r * 2.8)}" height="${f(h * 0.88)}" fill="none" stroke="#f5f2ec" stroke-width="0.35" opacity="0.55"/>`;
      };
      const troquel = (y: number) => `<line x1="${f(s * 0.04)}" y1="${f(y)}" x2="${f(m.anchoMm - s * 0.04)}" y2="${f(y)}" stroke="#9a948a" stroke-width="0.4" stroke-dasharray="2 1.6"/>`;
      let c = fondoLiso(total(m), "#f5f2ec");
      if (tipo === "interior-alt") {
        c += rayas(0, m.anchoMm, H - H * 0.035 - raya * 3.4) + troquel(H * 0.06);
        c += codigoBarras(der.x + der.w - s * 0.04 - s * 0.24, H * 0.06 - s * 0.045, s * 0.24, s * 0.035, "#2b2b2b", 3);
      } else {
        c += tipo === "apertura" ? rayas(der.x, der.w, H * 0.035) : rayas(0, m.anchoMm, H * 0.035);
        c += troquel(H - H * 0.06);
        c += codigoBarras(der.x + der.w - s * 0.04 - s * 0.24, H - H * 0.06 + s * 0.01, s * 0.24, s * 0.035, "#2b2b2b", 5);
      }
      if (tipo === "apertura") c += talon(izq, H * 0.06, H * 0.35);
      if (tipo === "cierre") c += talon(der, H * 0.1, H * 0.2);
      return svg(m, c);
    },
    zona: zonaCon(
      (tipo, lado, m) => {
        const s = corto(m);
        const H = m.altoMm;
        const rayas = menos(H * 0.035 + H * 0.022 * 3.4, 13) + 3;
        const pie = menos(H * 0.06 + s * 0.01, 13) + 3;
        if (tipo === "interior-alt") return { abajo: rayas, arriba: menos(H * 0.06, 13) + 2 };
        if (tipo === "apertura" && lado === "izq") return { abajo: pie };
        return { arriba: rayas, abajo: pie };
      },
      "arriba",
    ),
    textos: (tipo, m) => {
      const ts = tituloEnMayusculas(
        textosClasicos({
          titulo: "Bebas Neue",
          texto: "Work Sans",
          color: "#fdf8ef",
          acento: "#edae49",
          ejemplos: { titulo: "Barcelona – París", subtitulo: "Interrail 2026", fecha: "Julio 2026", frase: "Próxima estación: casa" },
          escalaTitulo: 0.1,
          posicion: "arriba",
        })(tipo, m),
      );
      // La frase del cierre va adentro del talón, en mayúsculas.
      return tipo === "cierre" ? ts.map((t) => ({ ...t, mayusculas: true, y: m.altoMm * 0.14 })) : ts;
    },
  },
  {
    id: "europa-07-islas-griegas",
    tema: "europa",
    nombre: "Islas griegas",
    descripcion: "Casitas blancas, cúpulas azules y buganvilias sobre el Egeo. Luminoso, para Santorini y Mykonos.",
    papel: "#ffffff",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const azul = "#1f5fa8";
      const cielo = degradado("gc", total(m), "#e4f1fb", "#ffffff");
      const mar = m.altoMm * 0.05;
      const alto = s * (fuerte(tipo) ? 0.3 : 0.22);
      let c = cielo.cuerpo;
      const pie = m.altoMm - mar;
      c += `<rect x="0" y="${f(pie)}" width="${f(m.anchoMm)}" height="${f(mar)}" fill="#2b7bc4"/><rect x="0" y="${f(pie + mar * 0.45)}" width="${f(m.anchoMm)}" height="${f(mar * 0.55)}" fill="${azul}"/>`;
      if (tipo === "apertura") {
        c += `<circle cx="${f(izq.x + izq.w * 0.5)}" cy="${f(m.altoMm * 0.15)}" r="${f(s * 0.045)}" fill="#f6c453" opacity="0.85"/>`;
        c += casasGriegas({ x: der.x, y: 0, w: der.w, h: pie }, alto, 3, azul);
      } else if (tipo === "cierre") {
        c += casasGriegas({ x: izq.x, y: 0, w: izq.w, h: pie }, alto, 8, azul);
      } else if (tipo === "interior") {
        c += casasGriegas({ x: izq.x, y: 0, w: izq.w * 0.28, h: pie }, alto, 5, azul);
        c += casasGriegas({ x: der.x + der.w * 0.72, y: 0, w: der.w * 0.28, h: pie }, alto, 6, azul);
      } else {
        c += `<rect x="0" y="0" width="${f(m.anchoMm)}" height="${f(m.altoMm * 0.03)}" fill="${azul}"/>`;
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const mar = m.altoMm * 0.05;
      const alto = s * (fuerte(tipo) ? 0.3 : 0.22);
      const casas = menos(mar + alto * 0.98, 13) + 3;
      const soloMar = menos(mar, 13) + 3;
      if (tipo === "apertura") return lado === "der" ? { abajo: casas } : { abajo: soloMar };
      if (tipo === "cierre") return lado === "izq" ? { abajo: casas } : { abajo: soloMar };
      if (tipo === "interior") return { exterior: menos((m.anchoMm / 2) * 0.28, 13) + 3, abajo: soloMar };
      return { abajo: soloMar, arriba: menos(m.altoMm * 0.03, 13) + 3 };
    }),
    textos: textosClasicos({
      titulo: "Dancing Script",
      texto: "Quicksand",
      color: "#1f5fa8",
      acento: "#d6457a",
      ejemplos: { titulo: "Grecia 2026", subtitulo: "Santorini & Mykonos", fecha: "Agosto 2026", frase: "Azul que no se olvida" },
      escalaTitulo: 0.12,
    }),
  },
  {
    id: "europa-08-paris-chic",
    tema: "europa",
    nombre: "París chic",
    descripcion: "Toldo a rayas de bistró en negro y blanco sobre rosa empolvado. Romántico, ideal para lunas de miel.",
    papel: "#fbf1f0",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      let c = fondoLiso(total(m), "#fbf1f0");
      const alto = m.altoMm * (fuerte(tipo) ? 0.14 : 0.08);
      if (tipo === "interior-alt") {
        c += `<rect x="0" y="0" width="${f(m.anchoMm)}" height="${f(m.altoMm * 0.012)}" fill="#1d1d1f"/>`;
        const y = m.altoMm * 0.955;
        for (let i = 0; i < 5; i++) c += `<rect x="0" y="${f(y + (i * m.altoMm * 0.045) / 5)}" width="${f(m.anchoMm)}" height="${f(m.altoMm * 0.0045)}" fill="#1d1d1f"/>`;
        c += torre(der.x + der.w - s * 0.1, y - s * 0.01, s * 0.2, "#1d1d1f", "#fbf1f0");
      } else {
        c += toldo({ x: 0, y: 0, w: m.anchoMm, h: alto }, s * 0.07, "#1d1d1f", "#ffffff", "#c46a7a");
      }
      if (tipo === "apertura") {
        // Un corazoncito rosa sobre el título.
        const hx = izq.x + izq.w / 2;
        const hy = m.altoMm * 0.25;
        const k = s * 0.02;
        c += `<path d="M ${f(hx)} ${f(hy + k)} C ${f(hx - k * 2)} ${f(hy - k * 0.2)} ${f(hx - k)} ${f(hy - k * 1.6)} ${f(hx)} ${f(hy - k * 0.6)} C ${f(hx + k)} ${f(hy - k * 1.6)} ${f(hx + k * 2)} ${f(hy - k * 0.2)} ${f(hx)} ${f(hy + k)} Z" fill="#c46a7a"/>`;
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const alto = m.altoMm * (fuerte(tipo) ? 0.14 : 0.08) + s * 0.03;
      if (tipo === "interior-alt") return lado === "der" ? { abajo: menos(m.altoMm * 0.045 + s * 0.2, 14) + 2, arriba: 2 } : { abajo: menos(m.altoMm * 0.045, 14) + 3, arriba: 2 };
      if (tipo === "cierre" && lado === "der") return { arriba: m.altoMm * 0.4 };
      return { arriba: menos(alto, 14) + 3 };
    }),
    textos: (tipo, m) => {
      const ts = textosClasicos({
        titulo: "Alex Brush",
        texto: "Montserrat",
        color: "#1d1d1f",
        acento: "#c46a7a",
        ejemplos: { titulo: "París, je t'aime", subtitulo: "Luna de miel", fecha: "Mayo 2026", frase: "Siempre nos quedará París" },
        escalaTitulo: 0.12,
      })(tipo, m);
      // Bajo el toldo: el título y la frase bajan un poco.
      return correr(ts, { dy: m.altoMm * (tipo === "cierre" ? 0.1 : 0.04) });
    },
  },
  {
    id: "europa-09-toscana",
    tema: "europa",
    nombre: "Toscana terracota",
    descripcion: "Ocres cálidos, lomas suaves y cipreses en los bordes. Sabor a Roma, Florencia y la campiña italiana.",
    papel: "#f3e3cf",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const fondo = degradado("tf", total(m), "#f6e8d6", "#ecd5b8");
      const g = grano("tg", m, 0.1, 1);
      const altoLoma = m.altoMm * (fuerte(tipo) ? 0.13 : 0.08);
      let c = fondo.cuerpo;
      const verde = "#4f5d2f";
      const grupoCipreses = (x: number, sentido: number, h: number) =>
        cipres(x, m.altoMm - altoLoma * 0.4, h, verde) + cipres(x + sentido * h * 0.14, m.altoMm - altoLoma * 0.35, h * 0.78, "#5f6f38") + cipres(x + sentido * h * 0.27, m.altoMm - altoLoma * 0.3, h * 0.6, verde);
      if (tipo === "interior-alt") {
        c += `<rect x="0" y="${f(m.altoMm * 0.93)}" width="${f(m.anchoMm)}" height="${f(m.altoMm * 0.07)}" fill="#c0643f"/><rect x="0" y="${f(m.altoMm * 0.915)}" width="${f(m.anchoMm)}" height="${f(m.altoMm * 0.006)}" fill="#c0643f"/>`;
        c += rama(izq.x + s * 0.02, s * 0.04, s * 0.38, 6, "#7b8a52", 14, { hojas: 11, tallo: "#6b5a3a", anchoHoja: 0.3 });
        c += rama(der.x + der.w - s * 0.02, s * 0.04, s * 0.32, 174, "#93a06a", 19, { hojas: 9, tallo: "#6b5a3a", anchoHoja: 0.3 });
      } else {
        const hc = s * (fuerte(tipo) ? 0.42 : 0.3);
        c += grupoCipreses(izq.x + s * 0.06, 1, hc) + grupoCipreses(der.x + der.w - s * 0.06, -1, hc);
        c += lomas(total(m), altoLoma, ["#d9b98a", "#c9a066", "#b5895a"], tipo === "interior" ? 4 : 2);
        if (tipo === "apertura") c += `<circle cx="${f(izq.x + izq.w / 2)}" cy="${f(m.altoMm * 0.19)}" r="${f(s * 0.03)}" fill="#c0643f" opacity="0.85"/>`;
      }
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const altoLoma = m.altoMm * (fuerte(tipo) ? 0.13 : 0.08);
      if (tipo === "interior-alt") return { abajo: menos(m.altoMm * 0.09, 13) + 3, arriba: menos(s * 0.12, 13) };
      return { abajo: menos(altoLoma * (deTitulo(tipo, lado) ? 0.7 : 1), 13) + 3, exterior: menos(s * 0.06 + s * 0.08, 13) + 3 };
    }),
    textos: textosClasicos({
      titulo: "Courgette",
      texto: "Lora",
      color: "#7a3b22",
      acento: "#a8613b",
      ejemplos: { titulo: "Roma y la Toscana", subtitulo: "Dolce vita en familia", fecha: "Junio 2026", frase: "Arrivederci, Italia" },
      escalaTitulo: 0.095,
    }),
  },
  {
    id: "europa-10-amsterdam",
    tema: "europa",
    nombre: "Casitas de Ámsterdam",
    descripcion: "Casas angostas de colores junto al canal y una hilera de tulipanes. Alegre y lleno de color.",
    papel: "#f4f7f6",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const colores = ["#c0573e", "#e0a43a", "#4f7f63", "#3e6e96", "#d98b9b", "#8a5a44"];
      const agua = m.altoMm * 0.06;
      const pie = m.altoMm - agua;
      const alto = s * (fuerte(tipo) ? 0.34 : 0.25);
      let c = fondoLiso(total(m), "#f4f7f6");
      c += canal({ x: 0, y: pie, w: m.anchoMm, h: agua }, "#5b8fa8", "#cfe3ec", 3);
      if (tipo === "apertura") c += filaCasas({ x: der.x, y: 0, w: der.w, h: pie }, alto, colores, 2);
      else if (tipo === "cierre") c += filaCasas({ x: izq.x, y: 0, w: izq.w, h: pie }, alto, colores, 6);
      else if (tipo === "interior") {
        c += filaCasas({ x: izq.x, y: 0, w: izq.w * 0.24, h: pie }, alto, colores, 4);
        c += filaCasas({ x: der.x + der.w * 0.76, y: 0, w: der.w * 0.24, h: pie }, alto, colores, 5);
      } else {
        const ht = m.altoMm * 0.07;
        const paso = ht * 0.55;
        const tul = ["#e04f5f", "#f2b134", "#e889a6", "#ffffff"];
        let i = 0;
        for (let x = paso / 2; x < m.anchoMm; x += paso, i++) c += tulipan(x, pie, ht * (0.85 + (i % 3) * 0.08), tul[i % tul.length]!, "#4f7f63");
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = corto(m);
      const agua = m.altoMm * 0.06;
      const alto = s * (fuerte(tipo) ? 0.34 : 0.25);
      const casas = menos(agua + alto, 13) + 3;
      const soloAgua = menos(agua, 13) + 3;
      if (tipo === "apertura") return lado === "der" ? { abajo: casas } : { abajo: soloAgua };
      if (tipo === "cierre") return lado === "izq" ? { abajo: casas } : { abajo: soloAgua };
      if (tipo === "interior") return { exterior: menos((m.anchoMm / 2) * 0.24, 13) + 3, abajo: soloAgua };
      return { abajo: menos(agua + m.altoMm * 0.08, 13) + 3 };
    }),
    textos: textosClasicos({
      titulo: "Pacifico",
      texto: "Nunito",
      color: "#2e4a62",
      acento: "#c0573e",
      ejemplos: { titulo: "Ámsterdam 2026", subtitulo: "Canales, bicis y tulipanes", fecha: "Abril 2026", frase: "Un viaje para recordar" },
      escalaTitulo: 0.09,
    }),
  },
];
