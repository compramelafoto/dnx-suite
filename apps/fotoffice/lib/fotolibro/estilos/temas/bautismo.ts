import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  degradado,
  estrellas,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  grano,
  hoja,
  lunares,
  manchaAcuarela,
  olas,
  paginas,
  rama,
  svg,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/*
 * Estilos de bautismo: tiernos y sobrios. Palomas, nubes, la concha del agua bautismal, olivo,
 * encaje del ropón y la vela. Todo en SVG con medidas en milímetros, relativo a la página.
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
// Piezas propias del bautismo
// ---------------------------------------------------------------------------------------------

/** Una paloma en vuelo, mirando a la derecha (o a la izquierda con `espejo`). `tam` es su ancho. */
function paloma(x: number, y: number, tam: number, color: string, o: { giro?: number; espejo?: boolean; ala?: string; opacidad?: number } = {}): string {
  const sx = o.espejo ? -tam : tam;
  const cuerpo =
    "M0.46 -0.06 L0.38 -0.08 C0.35 -0.14 0.26 -0.15 0.22 -0.1 C0.16 -0.03 0.08 0.02 -0.05 0.04 C-0.2 0.06 -0.32 0.04 -0.5 0.1 L-0.43 0.16 L-0.5 0.22 C-0.3 0.2 -0.15 0.2 0 0.17 C0.18 0.14 0.3 0.06 0.36 -0.02 Z";
  const alaAtras = "M0.1 0 C0.08 -0.22 0.02 -0.4 -0.12 -0.52 C-0.1 -0.36 -0.12 -0.18 -0.18 -0.08 C-0.08 -0.02 0.02 0.01 0.1 0 Z";
  const alaFrente = "M0.14 0.02 C0.04 -0.2 -0.08 -0.36 -0.34 -0.48 C-0.26 -0.34 -0.24 -0.2 -0.28 -0.1 C-0.14 -0.02 0 0.04 0.14 0.02 Z";
  return `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(o.giro ?? 0)}) scale(${r2(sx)} ${r2(tam)})" opacity="${o.opacidad ?? 1}"><path d="${alaAtras}" fill="${o.ala ?? color}" opacity="0.6"/><path d="${cuerpo}" fill="${color}"/><path d="${alaFrente}" fill="${o.ala ?? color}"/></g>`;
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

/** Una nube de copitos redondos, con la base plana. `ancho` es su ancho total. */
function nube(x: number, y: number, ancho: number, color: string, opacidad = 1, sombra?: string): string {
  const u = ancho;
  const bolas: [number, number, number][] = [
    [-0.32, -0.02, 0.17],
    [-0.12, -0.14, 0.24],
    [0.13, -0.1, 0.21],
    [0.33, -0.01, 0.15],
  ];
  const forma = (dy: number, c: string) =>
    bolas.map(([bx, by, br]) => `<circle cx="${r2(x + bx * u)}" cy="${r2(y + by * u + dy)}" r="${r2(br * u)}" fill="${c}"/>`).join("") +
    `<rect x="${r2(x - 0.45 * u)}" y="${r2(y - 0.06 * u + dy)}" width="${r2(0.9 * u)}" height="${r2(0.12 * u)}" rx="${r2(0.06 * u)}" fill="${c}"/>`;
  return `<g opacity="${opacidad}">${sombra ? forma(u * 0.025, sombra) : ""}${forma(0, color)}</g>`;
}

/** La concha (venera) del agua bautismal, con la bisagra abajo en (x, y). */
function concha(x: number, y: number, r: number, color: string, linea: string, opacidad = 1): string {
  const n = 9;
  const punto = (ang: number, rr: number) => [x + rr * Math.cos(ang), y - rr * Math.sin(ang)] as const;
  const desde = (Math.PI * 160) / 180;
  const hasta = (Math.PI * 20) / 180;
  const angs = Array.from({ length: n + 1 }, (_, i) => desde + ((hasta - desde) * i) / n);
  const [x0, y0] = punto(angs[0]!, r);
  let d = `M ${r2(x)} ${r2(y)} L ${r2(x0)} ${r2(y0)}`;
  let costillas = "";
  for (let i = 0; i < n; i++) {
    const [cx, cy] = punto((angs[i]! + angs[i + 1]!) / 2, r * 1.13);
    const [px, py] = punto(angs[i + 1]!, r);
    d += ` Q ${r2(cx)} ${r2(cy)} ${r2(px)} ${r2(py)}`;
    if (i < n - 1) costillas += `<line x1="${r2(x)}" y1="${r2(y)}" x2="${r2(px)}" y2="${r2(py)}"/>`;
  }
  const oreja = `<path d="M ${r2(x - r * 0.32)} ${r2(y + r * 0.02)} L ${r2(x + r * 0.32)} ${r2(y + r * 0.02)} L ${r2(x + r * 0.2)} ${r2(y + r * 0.18)} L ${r2(x - r * 0.2)} ${r2(y + r * 0.18)} Z" fill="${color}"/>`;
  return `<g opacity="${opacidad}">${oreja}<path d="${d} Z" fill="${color}"/><g stroke="${linea}" stroke-width="${r2(r * 0.025)}" stroke-linecap="round">${costillas}</g></g>`;
}

/** Una gota de agua con la punta arriba. `tam` es su alto. */
function gota(x: number, y: number, tam: number, color: string, opacidad = 1): string {
  const k = tam / 2;
  return `<path d="M0 -1 C0.45 -0.35 0.7 0.05 0.7 0.35 A0.7 0.7 0 0 1 -0.7 0.35 C-0.7 0.05 -0.45 -0.35 0 -1 Z" fill="${color}" opacity="${opacidad}" transform="translate(${r2(x)} ${r2(y)}) scale(${r2(k)})"/>`;
}

/** Rama de olivo: hojas finas y alargadas, con aceitunas. */
function ramaOlivo(x: number, y: number, largo: number, angulo: number, hojaColor: string, aceituna: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = rama(x, y, largo, angulo, hojaColor, semilla, { hojas: 11, tamHoja: largo * 0.26, anchoHoja: 0.22 });
  out += `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(angulo)})">`;
  for (const t of [0.3, 0.55, 0.78]) {
    const lado = rnd() > 0.5 ? 1 : -1;
    out += `<ellipse cx="${r2(largo * t)}" cy="${r2(lado * largo * 0.06)}" rx="${r2(largo * 0.035)}" ry="${r2(largo * 0.025)}" fill="${aceituna}"/>`;
  }
  return `${out}</g>`;
}

/** Puntilla de encaje colgando de una línea horizontal: festón, agujeritos y pespunte. */
function encaje(x0: number, x1: number, y: number, tam: number, color: string, hueco: string, haciaAbajo = true): string {
  const n = Math.max(2, Math.round((x1 - x0) / tam));
  const paso = (x1 - x0) / n;
  const r = paso / 2;
  const dir = haciaAbajo ? 1 : -1;
  const banda = tam * 0.45;
  const yb = y + dir * banda;
  let d = `M ${r2(x0)} ${r2(y)} L ${r2(x0)} ${r2(yb)}`;
  let huecos = "";
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * paso;
    d += ` A ${r2(r)} ${r2(r)} 0 0 ${haciaAbajo ? 0 : 1} ${r2(xa + paso)} ${r2(yb)}`;
    huecos += `<circle cx="${r2(xa + r)}" cy="${r2(yb + dir * r * 0.42)}" r="${r2(r * 0.22)}" fill="${hueco}"/>`;
    huecos += `<circle cx="${r2(xa + r * 0.45)}" cy="${r2(yb + dir * r * 0.12)}" r="${r2(r * 0.09)}" fill="${hueco}"/><circle cx="${r2(xa + r * 1.55)}" cy="${r2(yb + dir * r * 0.12)}" r="${r2(r * 0.09)}" fill="${hueco}"/>`;
    huecos += `<circle cx="${r2(xa)}" cy="${r2(y + dir * banda * 0.5)}" r="${r2(banda * 0.16)}" fill="${hueco}"/>`;
  }
  d += ` L ${r2(x1)} ${r2(y)} Z`;
  const pespunte = `<line x1="${r2(x0)}" y1="${r2(y + dir * banda * 0.18)}" x2="${r2(x1)}" y2="${r2(y + dir * banda * 0.18)}" stroke="${hueco}" stroke-width="${r2(tam * 0.03)}" stroke-dasharray="${r2(tam * 0.08)} ${r2(tam * 0.06)}"/>`;
  return `<path d="${d}" fill="${color}"/>${huecos}${pespunte}`;
}

/** Un moño de cinta. `tam` es el ancho de las dos lazadas. */
function mono(x: number, y: number, tam: number, color: string, sombra: string): string {
  const lazada = "M0 0 C-0.3 -0.36 -0.56 -0.26 -0.5 0 C-0.56 0.26 -0.3 0.34 0 0 Z";
  const cola = "M0 0 L-0.24 0.6 L-0.14 0.54 L-0.07 0.66 L0.03 0.06 Z";
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(tam)})"><path d="${cola}" fill="${sombra}"/><path d="${cola}" fill="${sombra}" transform="scale(-1 1)"/><path d="${lazada}" fill="${color}"/><path d="${lazada}" fill="${color}" transform="scale(-1 1)"/><path d="M-0.36 -0.04 C-0.25 -0.1 -0.12 -0.06 -0.05 0 M0.36 -0.04 C0.25 -0.1 0.12 -0.06 0.05 0" stroke="${sombra}" stroke-width="0.025" fill="none"/><ellipse rx="0.09" ry="0.11" fill="${sombra}"/></g>`;
}

/** Vela bautismal con su llama y un halo de luz. `idHalo` es un radialGradient de defs. */
function vela(x: number, base: number, alto: number, cuerpo: string, borde: string, idHalo: string): string {
  const w = alto * 0.2;
  const yl = base - alto - alto * 0.16;
  const k = alto * 0.12;
  return (
    `<circle cx="${r2(x)}" cy="${r2(yl)}" r="${r2(alto * 0.42)}" fill="url(#${idHalo})"/>` +
    `<rect x="${r2(x - w / 2)}" y="${r2(base - alto)}" width="${r2(w)}" height="${r2(alto)}" rx="${r2(w * 0.12)}" fill="${cuerpo}" stroke="${borde}" stroke-width="${r2(w * 0.03)}"/>` +
    `<path d="M ${r2(x - w / 2)} ${r2(base - alto + w * 0.25)} q ${r2(w * 0.25)} ${r2(w * 0.3)} ${r2(w * 0.5)} 0 t ${r2(w * 0.5)} 0" stroke="${borde}" stroke-width="${r2(w * 0.04)}" fill="none"/>` +
    `<line x1="${r2(x)}" y1="${r2(base - alto)}" x2="${r2(x)}" y2="${r2(base - alto - alto * 0.05)}" stroke="#5b4a3a" stroke-width="${r2(w * 0.05)}"/>` +
    `<path d="M0 -1 C0.5 -0.3 0.62 0.1 0.6 0.35 A0.6 0.6 0 0 1 -0.6 0.35 C-0.62 0.1 -0.5 -0.3 0 -1 Z" fill="#f4b740" transform="translate(${r2(x)} ${r2(yl)}) scale(${r2(k)})"/>` +
    `<path d="M0 -1 C0.5 -0.3 0.62 0.1 0.6 0.35 A0.6 0.6 0 0 1 -0.6 0.35 C-0.62 0.1 -0.5 -0.3 0 -1 Z" fill="#fff3c4" transform="translate(${r2(x)} ${r2(yl + k * 0.25)}) scale(${r2(k * 0.5)})"/>`
  );
}

const halo = (id: string, color: string) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="0.75"/><stop offset="0.5" stop-color="${color}" stop-opacity="0.25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/** Media luna (la de la cuna). */
function luna(x: number, y: number, r: number, color: string): string {
  return `<path d="M ${r2(x)} ${r2(y - r)} A ${r2(r)} ${r2(r)} 0 1 0 ${r2(x)} ${r2(y + r)} A ${r2(r * 0.78)} ${r2(r * 0.78)} 0 1 1 ${r2(x)} ${r2(y - r)} Z" fill="${color}"/>`;
}

/** Junco de río: tallo curvo con la espiga marrón en la punta. */
function junco(x: number, base: number, alto: number, curva: number, tallo: string, punta: string): string {
  const tx = x + curva;
  const ty = base - alto;
  return `<path d="M ${r2(x)} ${r2(base)} Q ${r2(x + curva * 0.2)} ${r2(base - alto * 0.6)} ${r2(tx)} ${r2(ty)}" stroke="${tallo}" stroke-width="${r2(alto * 0.018)}" fill="none" stroke-linecap="round"/><ellipse cx="${r2(x + curva * 0.82)}" cy="${r2(base - alto * 0.86)}" rx="${r2(alto * 0.035)}" ry="${r2(alto * 0.1)}" fill="${punta}" transform="rotate(${r2((Math.atan2(curva, alto) * 180) / Math.PI)} ${r2(x + curva * 0.82)} ${r2(base - alto * 0.86)})"/>`;
}

/** Guirnalda de florcitas colgando entre dos puntos. */
function guirnalda(x0: number, x1: number, y: number, caida: number, tam: number, colores: string[], hojaColor: string, semilla: number): string {
  const rnd = azar(semilla);
  const cx = (x0 + x1) / 2;
  let out = `<path d="M ${r2(x0)} ${r2(y)} Q ${r2(cx)} ${r2(y + caida * 2)} ${r2(x1)} ${r2(y)}" stroke="${hojaColor}" stroke-width="${r2(tam * 0.06)}" fill="none"/>`;
  const n = Math.max(5, Math.round((x1 - x0) / (tam * 1.6)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + caida * 2) + t * t * y;
    out += hoja(px, py, tam * 0.9, 40 + rnd() * 50, hojaColor, 0.42, 0.85) + hoja(px, py, tam * 0.8, 130 + rnd() * 40, hojaColor, 0.42, 0.7);
    if (i % 2 === 0 || rnd() > 0.6) {
      const c = colores[Math.floor(rnd() * colores.length)]!;
      out += flor(px, py, tam * (0.55 + rnd() * 0.25), c, "#f6d36b", 5 + Math.floor(rnd() * 2), rnd() * 72);
    } else {
      out += `<circle cx="${r2(px)}" cy="${r2(py + tam * 0.3)}" r="${r2(tam * 0.18)}" fill="${colores[0]}"/>`;
    }
  }
  return out;
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

const ejemplos = { titulo: "Benicio", subtitulo: "Mi Bautismo", fecha: "14 · 03 · 2026", frase: "Bienvenido a la familia de Dios" };
const ejemplosNena = { titulo: "Catalina", subtitulo: "Mi Bautismo", fecha: "22 · 11 · 2026", frase: "Un regalo del cielo" };

const ESTILOS: EstiloFotolibro[] = [
  {
    id: "bautismo-01-cielo-de-nubes",
    tema: "bautismo",
    nombre: "Cielo de nubes",
    descripcion: "Cielo celeste con nubes blancas y palomas en vuelo. Tierno y luminoso.",
    papel: "#f3f8fc",
    margenMm: 15,
    esquinasMm: 1.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const cielo = degradado("b01c", total, "#cfe4f5", "#f6fafd");
      let c = cielo.cuerpo;
      // Nubes a lo largo del borde de abajo, más llenas en apertura y cierre.
      const rnd = azar(tipo === "interior-alt" ? 17 : 5);
      const paso = s * (esTitulo(tipo) ? 0.24 : 0.34);
      for (let x = -s * 0.05; x < m.anchoMm + s * 0.1; x += paso * (0.8 + rnd() * 0.4)) {
        c += nube(x, m.altoMm - s * 0.005, s * (0.2 + rnd() * 0.12), "#ffffff", 0.95, "#dbe9f5");
      }
      if (tipo === "apertura") {
        c += paloma(izq.x + izq.w * 0.42, izq.h * 0.15, s * 0.16, "#ffffff", { giro: -8, ala: "#eef5fb" });
        c += paloma(izq.x + izq.w * 0.6, izq.h * 0.1, s * 0.11, "#ffffff", { giro: -14, ala: "#eef5fb" });
        c += nube(der.x + der.w * 0.85, s * 0.08, s * 0.16, "#ffffff", 0.9);
      } else if (tipo === "cierre") {
        c += paloma(der.x + der.w * 0.88, s * 0.07, s * 0.09, "#ffffff", { giro: -10, ala: "#eef5fb" });
        c += nube(izq.x + s * 0.1, s * 0.07, s * 0.15, "#ffffff", 0.9);
      } else {
        const p = tipo === "interior" ? der : izq;
        c += paloma(tipo === "interior" ? p.x + p.w - s * 0.09 : p.x + s * 0.09, s * 0.065, s * 0.08, "#ffffff", { giro: -10, espejo: tipo !== "interior", ala: "#eef5fb" });
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.06, abajo: s * 0.07 })),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Quicksand", color: "#3f6a92", acento: "#6c93b8", ejemplos }),
  },
  {
    id: "bautismo-02-rosa-acuarela",
    tema: "bautismo",
    nombre: "Acuarela rosa",
    descripcion: "Manchas de acuarela rosa empolvado y ramitas de olivo. Delicado, para nenas.",
    papel: "#fdf8f6",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("b02g", m, 0.05);
      const k = esTitulo(tipo) ? 1 : 0.7;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdf8f6");
      c += manchaAcuarela(izq.x + s * 0.06, s * 0.06, s * 0.28 * k, "#eab5b9", "b02a", 4);
      c += manchaAcuarela(izq.x + s * 0.2, s * 0.02, s * 0.14 * k, "#f3cdb4", "b02a", 8, 2);
      c += manchaAcuarela(der.x + der.w - s * 0.06, der.h - s * 0.06, s * 0.28 * k, "#eab5b9", "b02a", 11);
      c += manchaAcuarela(der.x + der.w - s * 0.22, der.h - s * 0.02, s * 0.14 * k, "#f3cdb4", "b02a", 14, 2);
      c += ramaOlivo(izq.x + s * 0.015, s * 0.03, s * 0.3 * k, 22, "#8c9c86", "#b9a3a8", 3);
      c += ramaOlivo(izq.x + s * 0.03, s * 0.015, s * 0.22 * k, 62, "#a7b4a1", "#b9a3a8", 6);
      c += ramaOlivo(der.x + der.w - s * 0.015, der.h - s * 0.03, s * 0.3 * k, 202, "#8c9c86", "#b9a3a8", 9);
      c += ramaOlivo(der.x + der.w - s * 0.03, der.h - s * 0.015, s * 0.22 * k, 242, "#a7b4a1", "#b9a3a8", 12);
      if (tipo === "apertura") c += paloma(izq.x + izq.w * 0.5, izq.h * 0.18, s * 0.12, "#c9868d", { giro: -6, ala: "#dba3a8" });
      if (tipo === "interior-alt") c += manchaAcuarela(der.x + der.w - s * 0.05, s * 0.05, s * 0.12, "#f3cdb4", "b02a", 21, 2);
      return svg(m, c + g.cuerpo, filtroAcuarela("b02a") + g.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.08, abajo: s * 0.06, exterior: s * 0.06 })),
    textos: textosClasicos({ titulo: "Allura", texto: "Lora", color: "#9a5b63", acento: "#b98088", ejemplos: ejemplosNena, escalaTitulo: 0.12 }),
  },
  {
    id: "bautismo-03-concha-dorada",
    tema: "bautismo",
    nombre: "Concha dorada",
    descripcion: "Blanco puro, filete dorado y la concha del agua bautismal. Elegante y atemporal.",
    papel: "#ffffff",
    margenMm: 18,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const oro = "#c2a05a";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffffff");
      const sep = s * 0.045;
      for (const p of [izq, der]) c += filete(p, sep, oro, 0.4) + filete(p, sep + s * 0.012, oro, 0.18);
      if (tipo === "apertura") {
        c += concha(izq.x + izq.w / 2, izq.h * 0.25, s * 0.08, oro, "#ffffff");
        c += gota(izq.x + izq.w / 2 - s * 0.11, izq.h * 0.23, s * 0.025, oro, 0.7) + gota(izq.x + izq.w / 2 + s * 0.11, izq.h * 0.23, s * 0.025, oro, 0.7);
      } else if (tipo === "cierre") {
        c += concha(der.x + der.w / 2, der.h * 0.95 - sep, s * 0.035, oro, "#ffffff");
      } else {
        // Una conchita en el centro de arriba de cada página, chiquita, sobre el filete.
        for (const p of [izq, der]) c += fondoLiso({ x: p.x + p.w / 2 - s * 0.05, y: sep - s * 0.02, w: s * 0.1, h: s * 0.06 }, "#ffffff") + concha(p.x + p.w / 2, sep + s * 0.022, s * 0.032, oro, "#ffffff");
        if (tipo === "interior-alt") for (const p of [izq, der]) c += gota(p.x + p.w / 2, p.h - sep, s * 0.022, oro);
      }
      return svg(m, c);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.06, abajo: s * 0.04, exterior: s * 0.03, interior: s * 0.01 })),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Playfair Display", color: "#8c6d2c", acento: "#a88c55", ejemplos }),
  },
  {
    id: "bautismo-04-olivo-salvia",
    tema: "bautismo",
    nombre: "Olivo y salvia",
    descripcion: "Papel crema con ramas de olivo en las esquinas. Neutro, para nene o nena.",
    papel: "#f7f3ea",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("b04g", m, 0.07, 1);
      const k = esTitulo(tipo) ? 1.15 : 0.8;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f7f3ea");
      const verde = "#7d8f69";
      const verde2 = "#a3b18a";
      const aceituna = "#4f5d3a";
      if (tipo === "interior-alt") {
        // Las ramas cambian de esquina: arriba a la derecha y abajo a la izquierda.
        c += ramaOlivo(der.x + der.w, s * 0.04, s * 0.34 * k, 160, verde, aceituna, 5) + ramaOlivo(der.x + der.w - s * 0.04, 0, s * 0.26 * k, 118, verde2, aceituna, 8);
        c += ramaOlivo(izq.x, izq.h - s * 0.04, s * 0.34 * k, -20, verde, aceituna, 11) + ramaOlivo(izq.x + s * 0.04, izq.h, s * 0.26 * k, -62, verde2, aceituna, 14);
      } else {
        c += ramaOlivo(izq.x, s * 0.04, s * 0.34 * k, 20, verde, aceituna, 5) + ramaOlivo(izq.x + s * 0.04, 0, s * 0.26 * k, 62, verde2, aceituna, 8);
        c += ramaOlivo(der.x + der.w, der.h - s * 0.04, s * 0.34 * k, 200, verde, aceituna, 11) + ramaOlivo(der.x + der.w - s * 0.04, der.h, s * 0.26 * k, 242, verde2, aceituna, 14);
      }
      if (tipo === "apertura") c += cruz(izq.x + izq.w / 2, izq.h * 0.2, s * 0.07, "#8a7a5c", { trazo: true, grosor: 0.05 });
      if (tipo === "cierre") c += ramaOlivo(der.x + der.w * 0.38, der.h * 0.255, der.w * 0.24, 0, verde2, aceituna, 19);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.09, abajo: s * 0.08, exterior: s * 0.09 })),
    textos: textosClasicos({ titulo: "Sacramento", texto: "Raleway", color: "#4f5d3a", acento: "#7d8f69", ejemplos, escalaTitulo: 0.12 }),
  },
  {
    id: "bautismo-05-encaje-del-ropon",
    tema: "bautismo",
    nombre: "Encaje del ropón",
    descripcion: "Puntilla de encaje blanco sobre marfil y un moño de cinta, como el ropón del bautismo.",
    papel: "#f3ede3",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const papel = "#f3ede3";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, papel);
      c += lunares({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, s * 0.05, s * 0.0035, "#d9cdb8", 0.8);
      const tam = s * (esTitulo(tipo) ? 0.07 : 0.055);
      // Sombra suave y encaje encima, arriba y abajo de todo el pliego.
      c += `<g opacity="0.5" transform="translate(0 ${r2(tam * 0.06)})">${encaje(0, m.anchoMm, 0, tam, "#d8ccb6", "#d8ccb6")}${encaje(0, m.anchoMm, m.altoMm, tam, "#d8ccb6", "#d8ccb6", false)}</g>`;
      c += encaje(0, m.anchoMm, 0, tam, "#ffffff", papel) + encaje(0, m.anchoMm, m.altoMm, tam, "#ffffff", papel, false);
      const cinta = "#9fbfd8";
      const cintaOsc = "#7ea3c2";
      if (tipo === "apertura") {
        c += `<rect x="${r2(izq.x)}" y="${r2(tam * 1.05)}" width="${r2(izq.w)}" height="${r2(s * 0.014)}" fill="${cinta}"/>`;
        c += mono(izq.x + izq.w / 2, tam * 1.05 + s * 0.007, s * 0.12, cinta, cintaOsc);
      } else if (tipo === "cierre") {
        c += `<rect x="${r2(der.x)}" y="${r2(tam * 1.05)}" width="${r2(der.w)}" height="${r2(s * 0.01)}" fill="${cinta}"/>`;
      } else if (tipo === "interior-alt") {
        c += mono(der.x + der.w - s * 0.09, tam * 1.05, s * 0.07, cinta, cintaOsc);
      }
      return svg(m, c);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const tam = s * (esTitulo(tipo) ? 0.07 : 0.055);
      return zonaClasica({ arriba: tam * 0.9, abajo: tam * 0.9 })(tipo, l, m);
    },
    textos: textosClasicos({ titulo: "Tangerine", texto: "Libre Baskerville", color: "#5d6f82", acento: "#7ea3c2", ejemplos, escalaTitulo: 0.12 }),
  },
  {
    id: "bautismo-06-luz-de-vela",
    tema: "bautismo",
    nombre: "Luz de vela",
    descripcion: "Tonos cálidos y la vela bautismal encendida, con un halo dorado. Íntimo y emotivo.",
    papel: "#fbf3e6",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("b06f", total, "#fdf7ec", "#f3e2c8");
      const g = grano("b06g", m, 0.06);
      let c = fondo.cuerpo;
      const chispas = (p: { x: number; w: number; h: number }, sem: number) => estrellas({ x: p.x + p.w * 0.05, y: p.h * 0.03, w: p.w * 0.9, h: s * 0.1 }, "#d9b46a", 14, sem, s * 0.012);
      if (tipo === "apertura") {
        c += vela(izq.x + izq.w / 2, izq.h * 0.26, s * 0.13, "#fffaf0", "#d8c39a", "b06h");
        c += chispas(izq, 3);
        c += vela(der.x + der.w - s * 0.08, der.h - s * 0.03, s * 0.17, "#fffaf0", "#d8c39a", "b06h");
      } else if (tipo === "cierre") {
        c += vela(izq.x + s * 0.08, izq.h - s * 0.03, s * 0.15, "#fffaf0", "#d8c39a", "b06h");
        c += vela(der.x + der.w - s * 0.08, der.h - s * 0.03, s * 0.2, "#fffaf0", "#d8c39a", "b06h") + vela(der.x + der.w - s * 0.15, der.h - s * 0.03, s * 0.13, "#fffaf0", "#d8c39a", "b06h");
      } else {
        const p = tipo === "interior" ? der : izq;
        const x = tipo === "interior" ? p.x + p.w - s * 0.08 : p.x + s * 0.08;
        c += vela(x, p.h - s * 0.03, s * 0.17, "#fffaf0", "#d8c39a", "b06h");
        c += `<line x1="${r2(izq.x + s * 0.05)}" y1="${r2(s * 0.035)}" x2="${r2(der.x + der.w - s * 0.05)}" y2="${r2(s * 0.035)}" stroke="#d9b46a" stroke-width="0.3"/>`;
      }
      return svg(m, c + g.cuerpo, fondo.defs + halo("b06h", "#ffd98a") + g.defs);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const base = zonaClasica({ arriba: s * 0.03, abajo: s * 0.04 })(tipo, l, m);
      // La página que tiene la vela abajo reserva el costado exterior.
      const conVela = tipo === "apertura" ? l === "der" : tipo === "cierre" ? true : tipo === "interior" ? l === "der" : l === "izq";
      return conVela ? { ...base, exterior: s * (tipo === "cierre" && l === "der" ? 0.19 : 0.12) } : base;
    },
    textos: textosClasicos({ titulo: "Alex Brush", texto: "Crimson Text", color: "#7a5a2e", acento: "#a98545", ejemplos, escalaTitulo: 0.12 }),
  },
  {
    id: "bautismo-07-angelito-dormido",
    tema: "bautismo",
    nombre: "Angelito dormido",
    descripcion: "Celeste empolvado con luna, estrellitas y nubes. Dulce como un cuento de cuna.",
    papel: "#9fbcd6",
    margenMm: 15,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("b07f", total, "#93b3d0", "#b9cfe2");
      let c = fondo.cuerpo;
      const densidad = esTitulo(tipo) ? 60 : 28;
      c += estrellas({ x: 0, y: 0, w: m.anchoMm, h: s * 0.12 }, "#ffffff", Math.round((densidad * m.anchoMm) / 600), tipo === "interior-alt" ? 41 : 23, s * 0.022);
      c += estrellas({ x: 0, y: m.altoMm - s * 0.1, w: m.anchoMm, h: s * 0.1 }, "#fdf3c7", Math.round((densidad * 0.6 * m.anchoMm) / 600), 7, s * 0.018);
      if (tipo === "apertura") {
        c += luna(izq.x + izq.w / 2 + s * 0.02, izq.h * 0.17, s * 0.075, "#fdf3c7");
        c += nube(izq.x + izq.w / 2 - s * 0.03, izq.h * 0.23, s * 0.18, "#ffffff", 0.95);
      } else if (tipo === "cierre") {
        c += luna(der.x + der.w - s * 0.08, s * 0.07, s * 0.04, "#fdf3c7");
      } else {
        const p = tipo === "interior" ? izq : der;
        const x = tipo === "interior" ? p.x + s * 0.08 : p.x + p.w - s * 0.08;
        c += luna(x, s * 0.065, s * 0.035, "#fdf3c7") + nube(x + (tipo === "interior" ? 1 : -1) * s * 0.03, s * 0.09, s * 0.08, "#ffffff", 0.9);
      }
      return svg(m, c, fondo.defs);
    },
    zona: zonaRel((s) => ({ arriba: s * 0.07, abajo: s * 0.05 })),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Nunito", color: "#ffffff", acento: "#fdf3c7", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "bautismo-08-moderno-arena",
    tema: "bautismo",
    nombre: "Moderno arena",
    descripcion: "Ventana en arco color arena, cruz de línea fina y tipografía limpia. Actual y sobrio.",
    papel: "#f6f1ea",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const arena = "#e6d8c6";
      const tierra = "#c9a98a";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f6f1ea");
      // Ventana con el techo en arco, que termina antes de la zona de fotos.
      const ventana = (cx: number, top: number, base: number, ancho: number, color: string) => {
        const r = ancho / 2;
        return `<path d="M ${r2(cx - r)} ${r2(base)} L ${r2(cx - r)} ${r2(top + r)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(cx + r)} ${r2(top + r)} L ${r2(cx + r)} ${r2(base)} Z" fill="${color}"/>`;
      };
      if (tipo === "apertura") {
        const ancho = Math.min(izq.w * 0.7, izq.h * 0.5);
        c += ventana(izq.x + izq.w / 2, izq.h * 0.07, izq.h * 0.56, ancho, arena);
        c += cruz(izq.x + izq.w / 2, izq.h * 0.07 + ancho * 0.32, s * 0.06, tierra, { trazo: true, grosor: 0.04 });
        c += `<line x1="${r2(der.x + der.w * 0.92)}" y1="${r2(der.h * 0.08)}" x2="${r2(der.x + der.w * 0.92)}" y2="${r2(der.h * 0.92)}" stroke="${tierra}" stroke-width="0.35"/>`;
      } else if (tipo === "interior") {
        c += `<line x1="${r2(izq.x + izq.w * 0.06)}" y1="${r2(izq.h * 0.955)}" x2="${r2(izq.x + izq.w * 0.35)}" y2="${r2(izq.h * 0.955)}" stroke="${tierra}" stroke-width="0.35"/>`;
        c += cruz(der.x + der.w - s * 0.05, der.h - s * 0.05, s * 0.035, tierra, { trazo: true, grosor: 0.05 });
      } else if (tipo === "interior-alt") {
        c += fondoLiso({ x: izq.x, y: 0, w: izq.w * 0.14, h: izq.h }, arena);
        c += cruz(izq.x + izq.w * 0.07, izq.h * 0.12, s * 0.05, "#f6f1ea", { trazo: true, grosor: 0.05 });
      } else {
        c += fondoLiso({ x: der.x, y: 0, w: der.w, h: der.h * 0.28 }, arena);
        c += `<line x1="${r2(izq.x + izq.w * 0.08)}" y1="${r2(izq.h * 0.955)}" x2="${r2(izq.x + izq.w * 0.92)}" y2="${r2(izq.h * 0.955)}" stroke="${tierra}" stroke-width="0.3"/>`;
      }
      return svg(m, c);
    },
    zona: (tipo, l, m) => {
      if (tipo === "interior-alt" && l === "izq") return { exterior: (m.anchoMm / 2) * 0.14 };
      if (tipo === "apertura" && l === "der") return { exterior: (m.anchoMm / 2) * 0.06 };
      return zonaClasica({ abajo: lado(m) * 0.03 })(tipo, l, m);
    },
    textos: (tipo, m) =>
      textosClasicos({ titulo: "Playfair Display", texto: "Montserrat", color: "#5e4a38", acento: "#9c7b5d", ejemplos, escalaTitulo: tipo === "apertura" ? 0.085 : 0.09 })(tipo, m),
  },
  {
    id: "bautismo-09-agua-del-jordan",
    tema: "bautismo",
    nombre: "Agua del Jordán",
    descripcion: "Agua en acuarela azul y verde agua, con juncos y gotas. Fresco y lleno de significado.",
    papel: "#f8fbfb",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const g = grano("b09g", m, 0.05);
      let c = fondoLiso(total, "#f8fbfb");
      const alto = s * (esTitulo(tipo) ? 0.14 : 0.09);
      c += `<g filter="url(#b09a)" opacity="0.75">${olas(total, alto, ["#cfe8ea", "#9fcfd6", "#6fafc0"], tipo === "interior-alt" ? 13 : 5)}</g>`;
      const juncos = (x: number, dir: number, k: number, sem: number) => {
        const rnd = azar(sem);
        let out = "";
        for (let i = 0; i < 4; i++) out += junco(x + dir * i * s * 0.025, m.altoMm - alto * 0.4, s * (0.16 + rnd() * 0.1) * k, dir * s * (0.01 + rnd() * 0.04), "#6f8f74", "#8a6a4a");
        return out;
      };
      if (tipo === "apertura") {
        c += juncos(der.x + der.w - s * 0.04, -1, 1, 3);
        c += gota(izq.x + izq.w / 2, izq.h * 0.2, s * 0.06, "#6fafc0", 0.85) + gota(izq.x + izq.w / 2 - s * 0.05, izq.h * 0.23, s * 0.03, "#9fcfd6", 0.85) + gota(izq.x + izq.w / 2 + s * 0.05, izq.h * 0.23, s * 0.03, "#9fcfd6", 0.85);
      } else if (tipo === "cierre") {
        c += juncos(izq.x + s * 0.04, 1, 1, 7) + juncos(der.x + der.w - s * 0.04, -1, 0.8, 9);
      } else if (tipo === "interior") {
        c += juncos(der.x + der.w - s * 0.04, -1, 0.75, 11);
      } else {
        c += juncos(izq.x + s * 0.04, 1, 0.75, 15);
      }
      return svg(m, c + g.cuerpo, filtroAcuarela("b09a", 5) + g.defs);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const titulo = (tipo === "apertura" && l === "izq") || (tipo === "cierre" && l === "der");
      const conJuncos = tipo === "cierre" || (tipo === "apertura" && l === "der") || (tipo === "interior" && l === "der") || (tipo === "interior-alt" && l === "izq");
      return { ...zonaClasica()(tipo, l, m), abajo: s * (titulo ? 0.06 : esTitulo(tipo) ? 0.1 : 0.06), exterior: conJuncos ? s * 0.08 : 0 };
    },
    textos: textosClasicos({ titulo: "Satisfy", texto: "Work Sans", color: "#2f6476", acento: "#4f8fa0", ejemplos }),
  },
  {
    id: "bautismo-10-flores-silvestres",
    tema: "bautismo",
    nombre: "Flores silvestres",
    descripcion: "Guirnaldas de florcitas pastel sobre blanco con lunares. Alegre y primaveral.",
    papel: "#fffdf8",
    margenMm: 15,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffdf8");
      c += lunares({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, s * 0.06, s * 0.004, "#f1c9a5", 0.6);
      const colores = ["#f5c6cf", "#c8b6e2", "#a9d1ec", "#fbe3a1", "#ffffff"];
      const tam = s * 0.028;
      const caida = s * (esTitulo(tipo) ? 0.04 : 0.025);
      for (const [i, p] of [izq, der].entries()) {
        if (tipo === "interior" && i === 1) continue;
        if (tipo === "interior-alt" && i === 0) continue;
        c += guirnalda(p.x - tam, p.x + p.w + tam, s * 0.02, caida, tam, colores, "#9bb58f", 7 + i * 11 + (tipo === "cierre" ? 5 : 0));
      }
      // Ramito en la esquina de abajo de la página sin guirnalda.
      if (tipo === "interior" || tipo === "interior-alt") {
        const p = tipo === "interior" ? der : izq;
        const x = tipo === "interior" ? p.x + p.w - s * 0.05 : p.x + s * 0.05;
        c += rama(x, p.h - s * 0.02, s * 0.12, tipo === "interior" ? -120 : -60, "#9bb58f", 5, { hojas: 7 });
        c += flor(x, p.h - s * 0.03, tam, "#f5c6cf", "#f6d36b", 5) + flor(x + (tipo === "interior" ? -1 : 1) * tam * 1.6, p.h - s * 0.025, tam * 0.75, "#c8b6e2", "#f6d36b", 5);
      }
      return svg(m, c);
    },
    zona: (tipo, l, m) => {
      const s = lado(m);
      const conGuirnalda = !(tipo === "interior" && l === "der") && !(tipo === "interior-alt" && l === "izq");
      return zonaClasica({ arriba: conGuirnalda ? s * (esTitulo(tipo) ? 0.1 : 0.07) : 0, abajo: conGuirnalda ? 0 : s * 0.06 })(tipo, l, m);
    },
    textos: textosClasicos({ titulo: "Courgette", texto: "Nunito", color: "#8a6a9c", acento: "#c58b9a", ejemplos: { ...ejemplosNena, titulo: "Bautismo de Olivia", frase: "Con amor, tu familia" }, escalaTitulo: 0.075 }),
  },
];

export const BAUTISMO: EstiloFotolibro[] = ESTILOS.map((e) => (e.textos ? { ...e, textos: ajustarAlAncho(e.textos) } : e));
