import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  degradado,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  grano,
  manchaAcuarela,
  paginas,
  svg,
  type Rect,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos para sesiones de pareja: aniversarios, preboda y save the date.
 *
 * Las piezas que no están en `dibujo.ts` (corazones, sobres, estampillas, guirnaldas de luces,
 * colinas, cintas, abanicos art déco, lavanda) viven acá abajo, con la misma regla: SVG en
 * milímetros y azar de semilla fija.
 */

const f = (n: number) => Math.round(n * 100) / 100;
const todo = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });
/** El lado corto de una página: la vara para medir los adornos en cualquier formato. */
const corto = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);
const esTitulo = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";

/** Zona clásica (lugar del título) más lo que reserva cada estilo según el pliego y la página. */
const zonaCon =
  (extra: (s: number, tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>) =>
  (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> =>
    zonaClasica(extra(corto(m), tipo, lado, m))(tipo, lado, m);

const ejemplos = { titulo: "Cami & Joaco", subtitulo: "Cinco años juntos", fecha: "14 · 02 · 2026", frase: "Contigo, siempre" };

// ---------- Piezas propias ----------

/** Un corazón centrado en (x, y); `r` es la mitad del ancho. Con `trazo` sale sólo el contorno. */
function corazon(x: number, y: number, r: number, color: string, giro = 0, opacidad = 1, trazo?: number, filtro?: string): string {
  const p = (a: number, b: number) => `${f(a * r)} ${f(b * r)}`;
  const d = `M ${p(0, 0.75)} C ${p(-0.55, 0.38)} ${p(-1, 0.02)} ${p(-1, -0.38)} C ${p(-1, -0.86)} ${p(-0.42, -1.06)} ${p(0, -0.6)} C ${p(0.42, -1.06)} ${p(1, -0.86)} ${p(1, -0.38)} C ${p(1, 0.02)} ${p(0.55, 0.38)} ${p(0, 0.75)} Z`;
  const pintura = trazo ? `fill="none" stroke="${color}" stroke-width="${f(trazo)}" stroke-linejoin="round"` : `fill="${color}"`;
  return `<path d="${d}" ${pintura} opacity="${f(opacidad)}"${filtro ? ` filter="url(#${filtro})"` : ""} transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Corazoncitos sueltos dentro de un área, con tamaños y giros al azar. */
function corazones(area: Rect, colores: string[], cantidad: number, semilla: number, tam: number, filtro?: string): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const c = colores[Math.floor(rnd() * colores.length)]!;
    out += corazon(area.x + rnd() * area.w, area.y + rnd() * area.h, tam * (0.45 + rnd() * 0.75), c, (rnd() - 0.5) * 50, 0.55 + rnd() * 0.4, undefined, filtro);
  }
  return out;
}

/** Bordes de correo aéreo: rayas diagonales rojas y azules. */
const patronCorreo = (id: string, papel: string, a: string, b: string, ancho: number) =>
  `<pattern id="${id}" width="${f(ancho * 4)}" height="${f(ancho * 4)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${f(ancho * 4)}" height="${f(ancho * 4)}" fill="${papel}"/><rect width="${f(ancho * 1.3)}" height="${f(ancho * 4)}" fill="${a}"/><rect x="${f(ancho * 2)}" width="${f(ancho * 1.3)}" height="${f(ancho * 4)}" fill="${b}"/></pattern>`;

/** Estampilla con borde troquelado y un corazón. */
function estampilla(x: number, y: number, w: number, h: number, papel: string, color: string, giro: number): string {
  const r = Math.min(w, h) * 0.05;
  let out = `<g transform="rotate(${f(giro)} ${f(x + w / 2)} ${f(y + h / 2)})"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#fffdf8"/>`;
  const nx = Math.max(3, Math.round(w / (r * 2.8)));
  const ny = Math.max(3, Math.round(h / (r * 2.8)));
  for (let i = 0; i <= nx; i++) out += `<circle cx="${f(x + (w * i) / nx)}" cy="${f(y)}" r="${f(r)}" fill="${papel}"/><circle cx="${f(x + (w * i) / nx)}" cy="${f(y + h)}" r="${f(r)}" fill="${papel}"/>`;
  for (let i = 0; i <= ny; i++) out += `<circle cx="${f(x)}" cy="${f(y + (h * i) / ny)}" r="${f(r)}" fill="${papel}"/><circle cx="${f(x + w)}" cy="${f(y + (h * i) / ny)}" r="${f(r)}" fill="${papel}"/>`;
  out += `<rect x="${f(x + w * 0.14)}" y="${f(y + h * 0.12)}" width="${f(w * 0.72)}" height="${f(h * 0.76)}" fill="${color}" opacity="0.88"/>`;
  out += corazon(x + w / 2, y + h * 0.48, w * 0.2, "#fffdf8");
  return `${out}</g>`;
}

/** Matasellos: dos anillos y líneas onduladas. */
function matasellos(x: number, y: number, r: number, color: string): string {
  let out = `<g opacity="0.55" fill="none" stroke="${color}" stroke-width="${f(r * 0.05)}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.72)}"/>`;
  for (let i = 0; i < 4; i++) {
    const yy = y - r * 0.6 + i * r * 0.4;
    const x0 = x + r * 0.6;
    let d = `M ${f(x0)} ${f(yy)}`;
    for (let k = 0; k < 4; k++) d += ` q ${f(r * 0.3)} ${f(-r * 0.18)} ${f(r * 0.6)} 0 t ${f(r * 0.6)} 0`;
    out += `<path d="${d}"/>`;
  }
  return `${out}</g>`;
}

/** Sello de lacre: borde irregular, anillo hundido y un corazón en relieve. */
function lacre(x: number, y: number, r: number, color: string, oscuro: string, semilla: number): string {
  const rnd = azar(semilla);
  const pts: string[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = r * (0.92 + rnd() * 0.14);
    pts.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`);
  }
  return (
    `<polygon points="${pts.join(" ")}" fill="${color}" stroke="${color}" stroke-width="${f(r * 0.12)}" stroke-linejoin="round"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.7)}" fill="none" stroke="${oscuro}" stroke-width="${f(r * 0.06)}" opacity="0.7"/>` +
    corazon(x, y + r * 0.05, r * 0.36, oscuro, 0, 0.85) +
    `<ellipse cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.45)}" rx="${f(r * 0.22)}" ry="${f(r * 0.1)}" fill="#ffffff" opacity="0.22" transform="rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.45)})"/>`
  );
}

/** Un trazo continuo que en el medio se enlaza en un corazón (dibujo de una sola línea). */
function trazoConCorazon(x0: number, x1: number, y: number, cx: number, r: number, color: string, grosor: number, fondo?: string): string {
  const p = (a: number, b: number) => `${f(cx + a * r)} ${f(y + b * r)}`;
  const d =
    `M ${f(x0)} ${f(y)} Q ${f((x0 + cx) / 2)} ${f(y - r * 0.25)} ${f(cx)} ${f(y)}` +
    ` C ${p(-0.9, -0.6)} ${p(-1.05, -1.5)} ${p(-0.48, -1.62)} C ${p(-0.15, -1.68)} ${p(0, -1.42)} ${p(0, -1.18)}` +
    ` C ${p(0, -1.42)} ${p(0.15, -1.68)} ${p(0.48, -1.62)} C ${p(1.05, -1.5)} ${p(0.9, -0.6)} ${p(0, 0)}` +
    ` Q ${f((cx + x1) / 2)} ${f(y + r * 0.25)} ${f(x1)} ${f(y)}`;
  const mancha = fondo ? `<circle cx="${f(cx)}" cy="${f(y - r * 0.85)}" r="${f(r * 1.25)}" fill="${fondo}"/>` : "";
  return `${mancha}<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(grosor)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Colinas suaves en capas, desde abajo. */
function colinas(r: Rect, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  return colores
    .map((c, i) => {
      const n = 3 + i;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= n; j++) pts.push({ x: r.x + (r.w * j) / n, y: r.y + r.h - alto * (1 - i * 0.28) * (0.55 + rnd() * 0.45) });
      let d = `M ${f(r.x)} ${f(r.y + r.h)} L ${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
      for (let j = 0; j < n; j++) {
        const a = pts[j]!;
        const b = pts[j + 1]!;
        const mx = (a.x + b.x) / 2;
        d += ` C ${f(mx)} ${f(a.y)} ${f(mx)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`;
      }
      return `<path d="${d} L ${f(r.x + r.w)} ${f(r.y + r.h)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Guirnalda de lucecitas colgada entre dos puntos, con halo cálido (necesita el degradado `halo`). */
function guirnalda(x1: number, y1: number, x2: number, y2: number, caida: number, n: number, r: number, cable: string, color: string): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + 2 * caida;
  let out = `<path d="M ${f(x1)} ${f(y1)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}" stroke="${cable}" stroke-width="${f(r * 0.18)}" fill="none"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    out += `<circle cx="${f(x)}" cy="${f(y + r * 1.4)}" r="${f(r * 3.2)}" fill="url(#halo)"/>`;
    out += `<rect x="${f(x - r * 0.35)}" y="${f(y)}" width="${f(r * 0.7)}" height="${f(r * 0.6)}" fill="${cable}"/>`;
    out += `<ellipse cx="${f(x)}" cy="${f(y + r * 1.4)}" rx="${f(r * 0.75)}" ry="${f(r)}" fill="${color}"/>`;
  }
  return out;
}

/** Destellos desenfocados (bokeh). */
function bokeh(area: Rect, colores: string[], cantidad: number, semilla: number, tam: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const c = colores[Math.floor(rnd() * colores.length)]!;
    out += `<circle cx="${f(area.x + rnd() * area.w)}" cy="${f(area.y + rnd() * area.h)}" r="${f(tam * (0.4 + rnd()))}" fill="${c}" opacity="${f(0.12 + rnd() * 0.2)}"/>`;
  }
  return out;
}

/** Un pedazo de cinta de papel (washi) con los extremos rasgados. */
function cinta(x: number, y: number, largo: number, ancho: number, color: string, giro: number): string {
  const l = largo / 2;
  const a = ancho / 2;
  const dientes = 4;
  let d = `M ${f(-l)} ${f(-a)} L ${f(l)} ${f(-a)}`;
  for (let i = 1; i <= dientes; i++) d += ` L ${f(l + (i % 2 ? ancho * 0.08 : 0))} ${f(-a + (ancho * i) / dientes)}`;
  d += ` L ${f(-l)} ${f(a)}`;
  for (let i = dientes - 1; i >= 0; i--) d += ` L ${f(-l - (i % 2 ? ancho * 0.08 : 0))} ${f(-a + (ancho * i) / dientes)}`;
  return `<path d="${d} Z" fill="${color}" opacity="0.72" transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Racimo geométrico de esquina (estilo años 60): cuarto de círculo, medialuna, anillos y puntos. */
function racimoGeometrico(cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, s: number, colores: { a: string; b: string; c: string; linea: string }): string {
  const R = s * 0.15;
  const arcoCuarto = (r: number) => `M ${f(cx + sx * r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 ${sx * sy > 0 ? 1 : 0} ${f(cx)} ${f(cy + sy * r)}`;
  let out = `<path d="M ${f(cx)} ${f(cy)} L ${f(cx + sx * R)} ${f(cy)} A ${f(R)} ${f(R)} 0 0 ${sx * sy > 0 ? 1 : 0} ${f(cx)} ${f(cy + sy * R)} Z" fill="${colores.a}"/>`;
  out += `<path d="${arcoCuarto(R * 1.18)}" fill="none" stroke="${colores.linea}" stroke-width="${f(s * 0.004)}"/>`;
  out += `<path d="${arcoCuarto(R * 1.3)}" fill="none" stroke="${colores.linea}" stroke-width="${f(s * 0.004)}"/>`;
  // Medialuna apoyada en el borde.
  const mx = cx + sx * s * 0.27;
  const rm = s * 0.065;
  out += `<path d="M ${f(mx - rm)} ${f(cy)} A ${f(rm)} ${f(rm)} 0 0 ${sy > 0 ? 0 : 1} ${f(mx + rm)} ${f(cy)} Z" fill="${colores.b}"/>`;
  out += `<circle cx="${f(cx + sx * s * 0.38)}" cy="${f(cy + sy * s * 0.045)}" r="${f(s * 0.022)}" fill="${colores.c}"/>`;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out += `<circle cx="${f(cx + sx * (s * 0.18 + i * s * 0.022))}" cy="${f(cy + sy * (s * 0.07 + j * s * 0.022))}" r="${f(s * 0.0045)}" fill="${colores.linea}"/>`;
  return out;
}

/** Abanico art déco desde una esquina: rayos y arcos. */
function abanicoDeco(cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, r: number, color: string, grosor: number): string {
  let out = `<g fill="none" stroke="${color}" stroke-width="${f(grosor)}">`;
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    out += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + sx * Math.cos(a) * r)}" y2="${f(cy + sy * Math.sin(a) * r)}"/>`;
  }
  for (const k of [0.45, 0.72, 1]) out += `<path d="M ${f(cx + sx * r * k)} ${f(cy)} A ${f(r * k)} ${f(r * k)} 0 0 ${sx * sy > 0 ? 1 : 0} ${f(cx)} ${f(cy + sy * r * k)}"/>`;
  return `${out}</g>`;
}

/** Sol naciente art déco: medio círculo de rayos con líneas a los costados. */
function solDeco(cx: number, cy: number, r: number, color: string, grosor: number, invertido = false): string {
  const sy = invertido ? 1 : -1;
  let out = `<g fill="none" stroke="${color}" stroke-width="${f(grosor)}">`;
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    out += `<line x1="${f(cx + Math.cos(a) * r * 0.3)}" y1="${f(cy + sy * Math.sin(a) * r * 0.3)}" x2="${f(cx + Math.cos(a) * r)}" y2="${f(cy + sy * Math.sin(a) * r)}"/>`;
  }
  out += `<path d="M ${f(cx - r * 0.3)} ${f(cy)} A ${f(r * 0.3)} ${f(r * 0.3)} 0 0 ${invertido ? 0 : 1} ${f(cx + r * 0.3)} ${f(cy)}"/>`;
  out += `<line x1="${f(cx - r * 3)}" y1="${f(cy)}" x2="${f(cx + r * 3)}" y2="${f(cy)}"/><line x1="${f(cx - r * 2.2)}" y1="${f(cy - sy * r * 0.12)}" x2="${f(cx + r * 2.2)}" y2="${f(cy - sy * r * 0.12)}"/>`;
  return `${out}</g>`;
}

/** Una espiga de lavanda: tallo y capullos en pares. */
function lavanda(x: number, y: number, largo: number, angulo: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})"><line x1="0" y1="0" x2="${f(largo)}" y2="0" stroke="#7d8f69" stroke-width="${f(largo * 0.012)}" stroke-linecap="round"/>`;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = 0.52 + (i / n) * 0.48;
    const tam = largo * 0.036 * (1.1 - (i / n) * 0.45);
    for (const lado of [-1, 1]) {
      const c = colores[Math.floor(rnd() * colores.length)]!;
      out += `<ellipse cx="${f(largo * t)}" cy="${f(lado * tam * 0.6)}" rx="${f(tam * 0.95)}" ry="${f(tam * 0.55)}" fill="${c}" transform="rotate(${f(lado * 28)} ${f(largo * t)} ${f(lado * tam * 0.6)})"/>`;
    }
  }
  return `${out}</g>`;
}

/** Ramillete de lavanda atado con un moño. */
function ramilleteLavanda(x: number, y: number, tam: number, angulo: number, semilla: number, cinta = "#b9a3d0"): string {
  const colores = ["#8e7cc3", "#a28fd0", "#7a65b0", "#b9a8e0"];
  let out = "";
  for (let i = 0; i < 5; i++) out += lavanda(x, y, tam * (0.85 + (i % 3) * 0.08), angulo + (i - 2) * 6, colores, semilla + i * 7);
  const bx = x + Math.cos((angulo * Math.PI) / 180) * tam * 0.18;
  const by = y + Math.sin((angulo * Math.PI) / 180) * tam * 0.18;
  const b = tam * 0.07;
  out += `<g transform="translate(${f(bx)} ${f(by)}) rotate(${f(angulo + 90)})" fill="none" stroke="${cinta}" stroke-width="${f(tam * 0.014)}" stroke-linecap="round"><path d="M0 0 C ${f(-b)} ${f(-b * 1.2)} ${f(-b * 1.6)} ${f(-b * 0.2)} 0 0 C ${f(b * 1.6)} ${f(-b * 0.2)} ${f(b)} ${f(-b * 1.2)} 0 0"/><path d="M0 0 q ${f(-b * 0.4)} ${f(b)} ${f(-b * 0.9)} ${f(b * 1.5)} M0 0 q ${f(b * 0.4)} ${f(b)} ${f(b * 0.8)} ${f(b * 1.6)}"/></g>`;
  return out;
}

// ---------- Estilos ----------

export const PAREJA: EstiloFotolibro[] = [
  {
    id: "pareja-01-corazones-acuarela",
    tema: "pareja",
    nombre: "Corazones en acuarela",
    descripcion: "Manchas rosa y durazno con corazoncitos pintados a mano. Romántico y suave.",
    papel: "#fffaf8",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const k = esTitulo(tipo) ? 1 : 0.72;
      const g = grano("g", m, 0.04);
      const alt = tipo === "interior-alt";
      let c = fondoLiso(todo(m), "#fffaf8");
      // Dos esquinas opuestas; en el interior alternado se cruzan.
      const ax = izq.x + s * 0.06;
      const ay = alt ? izq.h - s * 0.06 : s * 0.06;
      const bx = der.x + der.w - s * 0.06;
      const by = alt ? s * 0.06 : der.h - s * 0.06;
      c += manchaAcuarela(ax, ay, s * 0.22 * k, "#f4a6b7", "a", 5);
      c += manchaAcuarela(ax + s * 0.14, ay + (alt ? 1 : -1) * s * 0.02, s * 0.12 * k, "#f7c59f", "a", 8, 2);
      c += manchaAcuarela(bx, by, s * 0.22 * k, "#f4a6b7", "a", 12);
      c += manchaAcuarela(bx - s * 0.15, by + (alt ? -1 : 1) * s * 0.02, s * 0.11 * k, "#e8a0bf", "a", 3, 2);
      const banda = s * 0.075;
      const colores = ["#e07a95", "#f29eb1", "#d65f80", "#f5b49a"];
      c += corazones({ x: izq.x + s * 0.03, y: alt ? izq.h - banda - s * 0.02 : s * 0.02, w: izq.w * 0.5, h: banda }, colores, 9, 21, s * 0.016);
      c += corazones({ x: der.x + der.w * 0.48, y: alt ? s * 0.02 : der.h - banda - s * 0.02, w: der.w * 0.48, h: banda }, colores, 9, 33, s * 0.016);
      if (tipo === "apertura") {
        // Un hilo de tres corazones sobre el título.
        for (let i = 0; i < 3; i++) c += corazon(izq.x + izq.w / 2 + (i - 1) * s * 0.05, izq.h * 0.2 - (i === 1 ? s * 0.012 : 0), s * (i === 1 ? 0.022 : 0.015), "#e07a95", (i - 1) * 14, 0.85);
      }
      if (tipo === "cierre") c += corazon(der.x + der.w / 2, der.h * 0.075, s * 0.02, "#e07a95", 0, 0.85);
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: zonaCon((s) => ({ arriba: s * 0.05, abajo: s * 0.05 })),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Lato", color: "#9b4d63", acento: "#d0728c", ejemplos }),
  },
  {
    id: "pareja-02-carta-de-amor",
    tema: "pareja",
    nombre: "Carta de amor",
    descripcion: "Borde de correo aéreo, estampillas y sello de lacre. Ideal para save the date.",
    papel: "#f7f0e3",
    margenMm: 16,
    esquinasMm: 0.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const papel = "#f7f0e3";
      const b = s * 0.028;
      const g = grano("g", m, 0.07, 1);
      let c = `<rect width="${f(m.anchoMm)}" height="${f(m.altoMm)}" fill="url(#correo)"/>`;
      for (const p of [izq, der]) c += fondoLiso({ x: p.x + b, y: b, w: p.w - 2 * b, h: p.h - 2 * b }, papel);
      if (tipo === "apertura") {
        c += lacre(izq.x + izq.w / 2, izq.h * 0.16, s * 0.055, "#a8323a", "#7a1f27", 4);
        c += estampilla(der.x + der.w - b - s * 0.15, b + s * 0.04, s * 0.1, s * 0.12, papel, "#c8553d", 5);
        c += matasellos(der.x + der.w - b - s * 0.2, b + s * 0.1, s * 0.035, "#2b4570");
      } else if (tipo === "interior") {
        c += estampilla(der.x + der.w - b - s * 0.14, b + s * 0.035, s * 0.085, s * 0.1, papel, "#2b4570", -4);
        c += matasellos(der.x + der.w - b - s * 0.19, b + s * 0.085, s * 0.03, "#c8553d");
      } else if (tipo === "interior-alt") {
        c += matasellos(izq.x + b + s * 0.06, izq.h - b - s * 0.06, s * 0.035, "#2b4570");
      } else {
        c += lacre(der.x + der.w / 2, der.h - b - s * 0.09, s * 0.05, "#a8323a", "#7a1f27", 9);
      }
      return svg(m, c + g.cuerpo, patronCorreo("correo", papel, "#c8553d", "#2b4570", b) + g.defs);
    },
    zona: zonaCon((s, tipo, lado) => {
      if ((tipo === "apertura" || tipo === "interior") && lado === "der") return { arriba: s * 0.13 };
      if (tipo === "interior-alt" && lado === "izq") return { abajo: s * 0.08 };
      if (tipo === "cierre" && lado === "der") return { abajo: s * 0.14 };
      return {};
    }),
    textos: textosClasicos({
      titulo: "Homemade Apple",
      texto: "Libre Baskerville",
      color: "#2b4570",
      acento: "#a8323a",
      escalaTitulo: 0.075,
      ejemplos: { titulo: "Sofi & Nico", subtitulo: "Save the date", fecha: "21 · 11 · 2026", frase: "Te espero en el altar" },
    }),
  },
  {
    id: "pareja-03-linea-continua",
    tema: "pareja",
    nombre: "Línea continua",
    descripcion: "Blanco puro y un trazo fino que se enlaza en un corazón. Minimalista y actual.",
    papel: "#ffffff",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const tinta = "#2d2d2d";
      const rubor = "#f6dcd3";
      const gr = Math.max(0.3, s * 0.0028);
      const r = s * 0.035;
      let c = fondoLiso(todo(m), "#ffffff");
      const abajo = (p: Rect, desde: number, hasta: number, cx: number) => trazoConCorazon(p.x + p.w * desde, p.x + p.w * hasta, p.h - s * 0.05, p.x + p.w * cx, r, tinta, gr, rubor);
      if (tipo === "apertura") {
        c += trazoConCorazon(izq.x + izq.w * 0.22, izq.x + izq.w * 0.78, izq.h * 0.22, izq.x + izq.w / 2, r * 0.85, tinta, gr, rubor);
        c += abajo(der, 0.35, 1, 0.78);
      } else if (tipo === "interior") {
        c += trazoConCorazon(der.x, der.x + der.w * 0.7, s * 0.1, der.x + der.w * 0.3, r, tinta, gr, rubor);
      } else if (tipo === "interior-alt") {
        c += abajo(izq, 0, 0.7, 0.25);
      } else {
        c += abajo(izq, 0, 0.7, 0.25);
        c += corazon(der.x + der.w / 2, der.h * 0.075, s * 0.018, tinta, 0, 1, gr);
      }
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "apertura" && lado === "der") return { abajo: s * 0.08 };
      if (tipo === "interior" && lado === "der") return { arriba: s * 0.08 };
      if ((tipo === "interior-alt" || tipo === "cierre") && lado === "izq") return { abajo: s * 0.08 };
      return {};
    }),
    textos: (tipo, m) =>
      textosClasicos({ titulo: "Montserrat", texto: "Work Sans", color: "#2d2d2d", acento: "#9a8f8a", ejemplos, escalaTitulo: 0.075 })(tipo, m).map((t) =>
        t.rol === "titulo" ? { ...t, mayusculas: true } : t,
      ),
  },
  {
    id: "pareja-04-golden-hour",
    tema: "pareja",
    nombre: "Golden hour",
    descripcion: "Sol de atardecer y colinas en durazno y coral, para sesiones al aire libre.",
    papel: "#fdf3e7",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const g = grano("g", m, 0.05);
      const capas = ["#f6d2b4", "#eeb093", "#dc8f7b"];
      let c = fondoLiso(todo(m), "#fdf3e7");
      const sol = (x: number, y: number, r: number, op = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#sol)" opacity="${op}"/>`;
      if (tipo === "apertura") {
        c += sol(izq.x + izq.w / 2, izq.h * 0.42, Math.min(izq.w * 0.34, izq.h * 0.26), 0.7);
        c += colinas({ x: der.x, y: 0, w: der.w, h: der.h }, s * 0.13, capas, 4);
      } else if (tipo === "interior") {
        c += colinas(todo(m), s * 0.11, capas, 8);
      } else if (tipo === "interior-alt") {
        c += sol(der.x + der.w, 0, s * 0.17, 0.9);
        c += colinas({ x: izq.x, y: 0, w: izq.w, h: izq.h }, s * 0.08, capas.slice(1), 13);
      } else {
        c += sol(der.x + der.w / 2, der.h * 0.19, Math.min(der.w * 0.3, der.h * 0.15), 0.65);
        c += colinas({ x: izq.x, y: 0, w: izq.w, h: izq.h }, s * 0.11, capas, 17);
      }
      const defs = `<radialGradient id="sol"><stop offset="0" stop-color="#f9c784"/><stop offset="0.6" stop-color="#f6ad8a"/><stop offset="1" stop-color="#f6ad8a" stop-opacity="0"/></radialGradient>`;
      return svg(m, c + g.cuerpo, defs + g.defs);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "apertura") return lado === "der" ? { abajo: s * 0.1 } : {};
      if (tipo === "interior") return { abajo: s * 0.09 };
      if (tipo === "interior-alt") return lado === "der" ? { arriba: s * 0.08, exterior: s * 0.06 } : { abajo: s * 0.06 };
      return lado === "izq" ? { abajo: s * 0.08 } : {};
    }),
    textos: textosClasicos({ titulo: "Alex Brush", texto: "Nunito", color: "#8a3b2a", acento: "#b8603f", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "pareja-05-luces-de-noche",
    tema: "pareja",
    nombre: "Luces de noche",
    descripcion: "Fondo noche con guirnaldas de lucecitas cálidas. Íntimo y elegante.",
    papel: "#1d1b30",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const fondo = degradado("n", todo(m), "#1d1b30", "#2c2440");
      const r = s * 0.013;
      const cable = "#5d5675";
      const luz = "#ffd27a";
      const n = Math.max(6, Math.round(izq.w / (s * 0.085)));
      let c = fondo.cuerpo;
      const arriba = (p: Rect, caida: number) => guirnalda(p.x - s * 0.01, -r, p.x + p.w + s * 0.01, -r, caida, n, r, cable, luz);
      if (tipo === "apertura" || tipo === "cierre") {
        c += arriba(izq, s * 0.06) + arriba(der, s * 0.06);
        c += guirnalda(izq.x, s * 0.03, izq.x + izq.w * 0.55, -r, s * 0.025, Math.round(n / 2), r * 0.8, cable, "#ffe6b0");
        c += bokeh({ x: der.x + der.w * 0.5, y: der.h * 0.86, w: der.w * 0.5, h: der.h * 0.14 }, [luz, "#f6a6b2"], 14, 3, s * 0.02);
      } else if (tipo === "interior") {
        c += arriba(izq, s * 0.045) + arriba(der, s * 0.045);
      } else {
        c += guirnalda(der.x - r, -r, der.x + der.w + r, s * 0.025, s * 0.04, n, r, cable, luz);
        c += bokeh({ x: izq.x, y: izq.h * 0.86, w: izq.w * 0.55, h: izq.h * 0.14 }, [luz, "#f6a6b2"], 14, 9, s * 0.02);
      }
      const defs = `<radialGradient id="halo"><stop offset="0" stop-color="${luz}" stop-opacity="0.55"/><stop offset="1" stop-color="${luz}" stop-opacity="0"/></radialGradient>`;
      return svg(m, c, fondo.defs + defs);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "interior") return { arriba: s * 0.08 };
      if (tipo === "interior-alt") return lado === "der" ? { arriba: s * 0.1 } : {};
      return { arriba: s * 0.1 };
    }),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Montserrat", color: "#ffd27a", acento: "#f3e6d0", ejemplos }),
  },
  {
    id: "pareja-06-album-vintage",
    tema: "pareja",
    nombre: "Álbum vintage",
    descripcion: "Papel sepia, cintas de papel en las esquinas y costura punteada, como un álbum de los 70.",
    papel: "#eee2cc",
    margenMm: 17,
    esquinasMm: 0.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const g = grano("g", m, 0.14, 1.2);
      const cintas = tipo === "interior-alt" ? ["#9fb6a8", "#d9a6a0"] : ["#d9a6a0", "#c8b57a"];
      let c = fondoLiso(todo(m), "#eee2cc");
      c += `<rect width="${f(m.anchoMm)}" height="${f(m.altoMm)}" fill="url(#vineta)"/>`;
      const d = s * 0.05;
      const largo = s * 0.13;
      const ancho = s * 0.034;
      for (const p of [izq, der]) {
        c += `<rect x="${f(p.x + s * 0.035)}" y="${f(s * 0.035)}" width="${f(p.w - s * 0.07)}" height="${f(p.h - s * 0.07)}" fill="none" stroke="#9b7b55" stroke-width="${f(s * 0.0025)}" stroke-dasharray="${f(s * 0.012)} ${f(s * 0.008)}"/>`;
        c += cinta(p.x + d, d, largo, ancho, cintas[0]!, -45) + cinta(p.x + p.w - d, p.h - d, largo, ancho, cintas[1]!, -45);
        if (tipo !== "interior") c += cinta(p.x + p.w - d, d, largo, ancho, cintas[1]!, 45) + cinta(p.x + d, p.h - d, largo, ancho, cintas[0]!, 45);
      }
      const etiqueta = (p: Rect, y0: number, y1: number) => {
        const x0 = p.x + p.w * 0.1;
        const w = p.w * 0.8;
        const n = s * 0.025;
        return `<path d="M ${f(x0 + n)} ${f(y0)} L ${f(x0 + w - n)} ${f(y0)} L ${f(x0 + w)} ${f(y0 + n)} L ${f(x0 + w)} ${f(y1 - n)} L ${f(x0 + w - n)} ${f(y1)} L ${f(x0 + n)} ${f(y1)} L ${f(x0)} ${f(y1 - n)} L ${f(x0)} ${f(y0 + n)} Z" fill="#e3d2b4" stroke="#9b7b55" stroke-width="${f(s * 0.003)}"/>`;
      };
      if (tipo === "apertura") c += etiqueta(izq, izq.h * 0.25, izq.h * 0.58);
      if (tipo === "cierre") c += etiqueta(der, der.h * 0.09, der.h * 0.28);
      if (tipo === "interior-alt") c += corazon(der.x + der.w - s * 0.11, der.h - s * 0.055, s * 0.018, "#a8504a", -10, 0.8, s * 0.004);
      const defs = `<radialGradient id="vineta" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#7a5a3a" stop-opacity="0"/><stop offset="1" stop-color="#7a5a3a" stop-opacity="0.28"/></radialGradient>`;
      return svg(m, c + g.cuerpo, defs + g.defs);
    },
    zona: zonaCon((s) => ({ arriba: s * 0.035, abajo: s * 0.035, exterior: s * 0.02, interior: s * 0.02 })),
    textos: textosClasicos({ titulo: "Bad Script", texto: "Crimson Text", color: "#5a3e2b", acento: "#8a6440", ejemplos, escalaTitulo: 0.085 }),
  },
  {
    id: "pareja-07-geometrico-calido",
    tema: "pareja",
    nombre: "Geométrico cálido",
    descripcion: "Formas de los años 60 en terracota, mostaza y verde. Moderno y con onda.",
    papel: "#f4ede1",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const col = { a: "#c8644a", b: "#e0a64b", c: "#5f7a61", linea: "#3b3a36" };
      const col2 = { a: "#5f7a61", b: "#c8644a", c: "#e0a64b", linea: "#3b3a36" };
      let c = fondoLiso(todo(m), "#f4ede1");
      const si = (p: Rect, k = col) => racimoGeometrico(p.x, 0, 1, 1, s, k);
      const sd = (p: Rect, k = col) => racimoGeometrico(p.x + p.w, 0, -1, 1, s, k);
      const ii = (p: Rect, k = col) => racimoGeometrico(p.x, p.h, 1, -1, s, k);
      const id = (p: Rect, k = col) => racimoGeometrico(p.x + p.w, p.h, -1, -1, s, k);
      if (tipo === "apertura") c += si(izq) + id(der, col2);
      else if (tipo === "interior") c += si(izq, col2) + id(der);
      else if (tipo === "interior-alt") c += ii(izq) + sd(der, col2);
      else c += ii(izq, col2) + id(der);
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = s * 0.11;
      if (tipo === "apertura") return lado === "der" ? { abajo: z } : {};
      if (tipo === "interior") return lado === "izq" ? { arriba: z } : { abajo: z };
      if (tipo === "interior-alt") return lado === "izq" ? { abajo: z } : { arriba: z };
      return { abajo: z };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Poppins", color: "#3b3a36", acento: "#c8644a", ejemplos, escalaTitulo: 0.085 }),
  },
  {
    id: "pareja-08-flores-silvestres",
    tema: "pareja",
    nombre: "Flores silvestres",
    descripcion: "Una pradera de flores de colores al pie de las páginas. Alegre y natural.",
    papel: "#fbf8f1",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      let c = fondoLiso(todo(m), "#fbf8f1");
      const pradera = (p: Rect, alto: number, semilla: number) => {
        const rnd = azar(semilla);
        const base = p.h + 0.5;
        let out = "";
        const pastos = Math.round(p.w / (s * 0.012));
        for (let i = 0; i < pastos; i++) {
          const x = p.x + rnd() * p.w;
          const h = alto * (0.3 + rnd() * 0.55);
          const lean = (rnd() - 0.5) * alto * 0.5;
          const color = ["#7a9a5b", "#9bb67a", "#5e7f48"][Math.floor(rnd() * 3)]!;
          out += `<path d="M ${f(x)} ${f(base)} Q ${f(x + lean * 0.3)} ${f(base - h * 0.6)} ${f(x + lean)} ${f(base - h)}" stroke="${color}" stroke-width="${f(s * 0.0035)}" fill="none" stroke-linecap="round"/>`;
        }
        const flores = Math.round(p.w / (s * 0.06));
        const colores = ["#c58ac9", "#f2c14e", "#ef8b6f", "#8cb8e0", "#f4a7b9", "#ffffff"];
        for (let i = 0; i < flores; i++) {
          const x = p.x + s * 0.02 + rnd() * (p.w - s * 0.04);
          const h = alto * (0.55 + rnd() * 0.45);
          const r = s * (0.012 + rnd() * 0.01);
          const color = colores[Math.floor(rnd() * colores.length)]!;
          out += `<path d="M ${f(x)} ${f(base)} Q ${f(x + (rnd() - 0.5) * s * 0.02)} ${f(base - h * 0.5)} ${f(x)} ${f(base - h)}" stroke="#6b8a50" stroke-width="${f(s * 0.003)}" fill="none"/>`;
          out += flor(x, base - h, r, color, color === "#f2c14e" ? "#c47f2c" : "#f2c14e", 5 + Math.floor(rnd() * 3), rnd() * 60, 0.95);
        }
        return out;
      };
      const petalos = (area: Rect, semilla: number) => {
        const rnd = azar(semilla);
        let out = "";
        for (let i = 0; i < 7; i++) {
          const x = area.x + rnd() * area.w;
          const y = area.y + rnd() * area.h;
          out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 0.008)}" ry="${f(s * 0.004)}" fill="${["#f4a7b9", "#c58ac9", "#ef8b6f"][i % 3]}" opacity="0.8" transform="rotate(${f(rnd() * 180)} ${f(x)} ${f(y)})"/>`;
        }
        return out;
      };
      if (tipo === "apertura") {
        c += pradera(der, s * 0.12, 3);
        c += petalos({ x: izq.x + izq.w * 0.25, y: izq.h * 0.1, w: izq.w * 0.5, h: izq.h * 0.14 }, 5);
      } else if (tipo === "interior") {
        c += pradera(izq, s * 0.09, 7) + pradera(der, s * 0.09, 11);
      } else if (tipo === "interior-alt") {
        c += pradera(der, s * 0.12, 13);
        c += petalos({ x: izq.x + s * 0.03, y: s * 0.02, w: izq.w * 0.4, h: s * 0.07 }, 17);
      } else {
        c += pradera(izq, s * 0.11, 19) + pradera(der, s * 0.12, 23);
      }
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "apertura") return lado === "der" ? { abajo: s * 0.11 } : {};
      if (tipo === "interior") return { abajo: s * 0.08 };
      if (tipo === "interior-alt") return lado === "der" ? { abajo: s * 0.11 } : { arriba: s * 0.05 };
      return { abajo: s * 0.1 };
    }),
    textos: textosClasicos({ titulo: "Caveat", texto: "Quicksand", color: "#4f6a3a", acento: "#b0628f", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "pareja-09-art-deco",
    tema: "pareja",
    nombre: "Art déco",
    descripcion: "Negro profundo con abanicos y filetes dorados. Elegancia de los años 20.",
    papel: "#121212",
    margenMm: 18,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const oro = "#c9a45c";
      const gr = Math.max(0.25, s * 0.0022);
      const sep = s * 0.04;
      let c = fondoLiso(todo(m), "#121212");
      for (const p of [izq, der]) {
        c += filete(p, sep, oro, gr * 1.6) + filete(p, sep * 1.3, oro, gr * 0.7);
        const x0 = p.x + sep * 1.3;
        const x1 = p.x + p.w - sep * 1.3;
        const y0 = sep * 1.3;
        const y1 = p.h - sep * 1.3;
        const r = s * 0.09;
        if (tipo === "interior-alt") {
          c += abanicoDeco(x0, y0, 1, 1, r, oro, gr) + abanicoDeco(x1, y0, -1, 1, r, oro, gr);
        } else {
          c += abanicoDeco(x0, y0, 1, 1, r, oro, gr) + abanicoDeco(x1, y0, -1, 1, r, oro, gr) + abanicoDeco(x0, y1, 1, -1, r, oro, gr) + abanicoDeco(x1, y1, -1, -1, r, oro, gr);
        }
      }
      if (tipo === "apertura") c += solDeco(izq.x + izq.w / 2, izq.h * 0.24, s * 0.06, oro, gr);
      if (tipo === "cierre") c += solDeco(der.x + der.w / 2, der.h - s * 0.2, s * 0.06, oro, gr, true);
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "interior-alt") return { arriba: s * 0.08, exterior: s * 0.02, interior: s * 0.02 };
      if (tipo === "cierre" && lado === "der") return { arriba: s * 0.08, abajo: s * 0.24 };
      if (tipo === "apertura" && lado === "izq") return { abajo: s * 0.03, exterior: s * 0.02, interior: s * 0.02 };
      return { arriba: s * 0.08, abajo: s * 0.08, exterior: s * 0.02, interior: s * 0.02 };
    }),
    textos: textosClasicos({ titulo: "Playfair Display", texto: "Raleway", color: "#d8b770", acento: "#a8946a", ejemplos, escalaTitulo: 0.085 }),
  },
  {
    id: "pareja-10-lavanda",
    tema: "pareja",
    nombre: "Lavanda",
    descripcion: "Ramilletes de lavanda atados con cinta, sobre un lila apenas insinuado.",
    papel: "#f8f6fb",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const tam = s * 0.27;
      let c = fondoLiso(todo(m), "#f8f6fb");
      const abajoIzq = (p: Rect, sem: number) =>
        manchaAcuarela(p.x + s * 0.1, p.h - s * 0.06, s * 0.14, "#cbb9e6", "a", sem, 2) + ramilleteLavanda(p.x + s * 0.03, p.h - s * 0.03, tam, -16, sem);
      const arribaDer = (p: Rect, sem: number) =>
        manchaAcuarela(p.x + p.w - s * 0.1, s * 0.06, s * 0.14, "#cbb9e6", "a", sem, 2) + ramilleteLavanda(p.x + p.w - s * 0.03, s * 0.03, tam, 164, sem);
      const abajoDer = (p: Rect, sem: number) =>
        manchaAcuarela(p.x + p.w - s * 0.1, p.h - s * 0.06, s * 0.14, "#cbb9e6", "a", sem, 2) + ramilleteLavanda(p.x + p.w - s * 0.03, p.h - s * 0.03, tam, 196, sem);
      if (tipo === "apertura") {
        // Dos espigas cruzadas sobre el título.
        const cx = izq.x + izq.w / 2;
        const cy = izq.h * 0.22;
        const colores = ["#8e7cc3", "#a28fd0", "#7a65b0"];
        c += lavanda(cx - s * 0.07, cy + s * 0.06, s * 0.19, -40, colores, 3) + lavanda(cx + s * 0.07, cy + s * 0.06, s * 0.19, 220, colores, 5) + lavanda(cx, cy + s * 0.07, s * 0.17, -90, colores, 7);
        c += abajoDer(der, 11);
      } else if (tipo === "interior") {
        c += abajoIzq(izq, 13) + arribaDer(der, 17);
      } else if (tipo === "interior-alt") {
        c += abajoDer(der, 19);
      } else {
        c += abajoIzq(izq, 23) + abajoDer(der, 29);
      }
      return svg(m, c, filtroAcuarela("a"));
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = s * 0.12;
      if (tipo === "apertura") return lado === "der" ? { abajo: z } : {};
      if (tipo === "interior") return lado === "izq" ? { abajo: z } : { arriba: z };
      if (tipo === "interior-alt") return lado === "der" ? { abajo: z } : {};
      return { abajo: z };
    }),
    textos: textosClasicos({ titulo: "Marck Script", texto: "Raleway", color: "#5d4a7a", acento: "#8e7cc3", ejemplos, escalaTitulo: 0.1 }),
  },
];
