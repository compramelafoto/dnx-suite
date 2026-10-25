import type { EstiloFotolibro, Medidas } from "../tipos";
import {
  azar,
  confeti,
  degradado,
  estrella,
  estrellas,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  globo,
  grano,
  manchaAcuarela,
  paginas,
  rama,
  type Rect,
  svg,
} from "../dibujo";
import { textosClasicos } from "../textos";
import { arcoiris, banderines, bancoDeNubes, corazon, lunaLlena, nube, sol, tendedero, zonaCon } from "./bebes";

const f = (n: number) => Math.round(n * 100) / 100;
const total = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });
const lado = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);

const ejemplos = { titulo: "Te estamos esperando", subtitulo: "Dulce espera", fecha: "Marzo · 2026", frase: "Ya te queremos" };

export const EMBARAZO: EstiloFotolibro[] = [
  {
    id: "embarazo-01-dulce-espera",
    tema: "embarazo",
    nombre: "Dulce espera",
    descripcion: "Acuarela durazno y rosa con ramas de eucalipto: romántico y luminoso.",
    papel: "#fdf9f6",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("g", m, 0.05);
      const k = tipo === "apertura" || tipo === "cierre" ? 1 : 0.75;
      let c = fondoLiso(total(m), "#fdf9f6");
      c += manchaAcuarela(izq.x + s * 0.05, s * 0.06, s * 0.28 * k, "#f4b9a7", "a", 5, 4);
      c += manchaAcuarela(izq.x + s * 0.2, s * 0.0, s * 0.14 * k, "#f7d6c2", "a", 8, 2);
      c += manchaAcuarela(der.x + der.w - s * 0.05, der.h - s * 0.06, s * 0.28 * k, "#efb4bd", "a", 11, 4);
      c += rama(izq.x + s * 0.01, s * 0.03, s * 0.3 * k, 30, "#8aa596", 4, { redondas: true, hojas: 9 });
      c += rama(izq.x + s * 0.03, s * 0.01, s * 0.22 * k, 12, "#a9bfb1", 9, { redondas: true, hojas: 7 });
      c += rama(der.x + der.w - s * 0.01, der.h - s * 0.03, s * 0.3 * k, 210, "#8aa596", 14, { redondas: true, hojas: 9 });
      if (tipo === "interior-alt") c += rama(der.x + der.w - s * 0.01, s * 0.02, s * 0.18, 160, "#a9bfb1", 21, { redondas: true, hojas: 6 });
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const k = tipo === "apertura" || tipo === "cierre" ? 1 : 0.75;
      return l === "izq" ? { arriba: s * 0.14 * k, exterior: s * 0.04 } : { abajo: s * 0.14 * k, exterior: s * 0.04 };
    }),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Lora", color: "#8c5a5a", acento: "#7f9a8b", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "embarazo-02-sol-boho",
    tema: "embarazo",
    nombre: "Sol boho",
    descripcion: "Soles que asoman y arcos en mostaza, terracota y arena: cálido y actual.",
    papel: "#f4ebdf",
    margenMm: 16,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const colores = ["#c46e4f", "#e0a458", "#e8c9a6"];
      let c = fondoLiso(total(m), "#f4ebdf");
      if (tipo === "apertura") {
        const r = Math.min(izq.w * 0.07, m.altoMm * 0.06);
        c += sol(izq.x + izq.w / 2, m.altoMm * 0.16, r, "#e0a458", 16, 0.5);
        c += arcoiris(der.x + der.w, m.altoMm, s * 0.24, colores, s * 0.05);
      } else if (tipo === "cierre") {
        // Un sol que se pone en la esquina de abajo de la página izquierda.
        c += sol(izq.x + s * 0.02, m.altoMm - s * 0.02, s * 0.08, "#e0a458", 14, 0.5);
        c += arcoiris(der.x + der.w, m.altoMm, s * 0.2, colores, s * 0.045);
      } else {
        const derecha = tipo === "interior";
        const x = derecha ? der.x + der.w : izq.x;
        c += sol(x + (derecha ? -1 : 1) * s * 0.02, m.altoMm - s * 0.02, s * 0.075, "#e0a458", 14, 0.5);
        c += `<circle cx="${f(derecha ? izq.x + s * 0.05 : der.x + der.w - s * 0.05)}" cy="${f(s * 0.05)}" r="${f(s * 0.012)}" fill="#c46e4f"/>`;
      }
      // Filete fino terracota en el borde de abajo, de lado a lado.
      c += `<line x1="0" y1="${f(m.altoMm - s * 0.012)}" x2="${f(m.anchoMm)}" y2="${f(m.altoMm - s * 0.012)}" stroke="#c46e4f" stroke-width="${f(Math.max(0.4, s * 0.004))}"/>`;
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const adorno =
        (tipo === "apertura" && l === "der") || tipo === "cierre" || (tipo === "interior" && l === "der") || (tipo === "interior-alt" && l === "izq");
      return adorno ? { exterior: s * 0.1, abajo: s * 0.06 } : { abajo: s * 0.02 };
    }),
    textos: textosClasicos({ titulo: "Satisfy", texto: "Raleway", color: "#9a5038", acento: "#c4893f", ejemplos: { ...ejemplos, titulo: "Creciendo con amor" }, escalaTitulo: 0.1 }),
  },
  {
    id: "embarazo-03-luna-llena",
    tema: "embarazo",
    nombre: "Luna llena",
    descripcion: "Noche ciruela y lavanda con una luna llena enorme: sesión de embarazo al atardecer.",
    papel: "#3b2d4f",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const cielo = degradado("n", total(m), "#2f2442", "#6b5680");
      let c = cielo.cuerpo;
      c += estrellas(total(m), "#f6e9d2", Math.round(m.anchoMm * (tipo === "apertura" || tipo === "cierre" ? 0.22 : 0.1)), 13, s * 0.016);
      if (tipo === "apertura") {
        const r = Math.min(m.altoMm * 0.1, izq.w * 0.12);
        c += `<circle cx="${f(izq.x + izq.w / 2)}" cy="${f(m.altoMm * 0.15)}" r="${f(r * 1.5)}" fill="#f6e9d2" opacity="0.08"/>`;
        c += lunaLlena(izq.x + izq.w / 2, m.altoMm * 0.15, r, "#f4e4c4", "#c9b48f");
      } else if (tipo === "cierre") {
        c += lunaLlena(der.x + der.w / 2, m.altoMm * 0.065, m.altoMm * 0.04, "#f4e4c4", "#c9b48f");
      } else {
        const x = tipo === "interior" ? der.x + der.w - s * 0.055 : izq.x + s * 0.055;
        c += lunaLlena(x, s * 0.055, s * 0.03, "#f4e4c4", "#c9b48f");
      }
      // Horizonte de colinas suaves al pie.
      const y = m.altoMm - s * 0.035;
      c += `<path d="M 0 ${f(y)} Q ${f(m.anchoMm * 0.25)} ${f(y - s * 0.04)} ${f(m.anchoMm * 0.5)} ${f(y)} T ${f(m.anchoMm)} ${f(y)} L ${f(m.anchoMm)} ${f(m.altoMm)} L 0 ${f(m.altoMm)} Z" fill="#251c35" opacity="0.85"/>`;
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((_t, _l, m) => ({ abajo: lado(m) * 0.05 })),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Montserrat", color: "#f4e4c4", acento: "#cdb8e0", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "embarazo-04-baby-shower",
    tema: "embarazo",
    nombre: "Baby shower",
    descripcion: "Banderines, globos y confeti en pasteles: el libro de la fiesta para recibir al bebé.",
    papel: "#fffaf3",
    margenMm: 15,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const pasteles = ["#f6b8b1", "#a9d8c8", "#f8d98f", "#bfb1e0", "#a8cbe8"];
      let c = fondoLiso(total(m), "#fffaf3");
      const n = Math.max(8, Math.round(m.anchoMm / (s * 0.09)));
      const comba = s * (tipo === "apertura" || tipo === "cierre" ? 0.05 : 0.025);
      if (tipo === "interior-alt") {
        // Banderines en cada página por separado.
        c += banderines(izq.x, s * 0.015, izq.x + izq.w, s * 0.015, comba, Math.round(n / 2), pasteles, s * 0.06, "#c9b8a6");
        c += banderines(der.x, s * 0.015, der.x + der.w, s * 0.015, comba, Math.round(n / 2), [...pasteles].reverse(), s * 0.06, "#c9b8a6");
      } else {
        c += banderines(0, s * 0.015, m.anchoMm, s * 0.015, comba * (m.anchoMm / (2 * s)), n, pasteles, s * 0.07, "#c9b8a6");
      }
      c += confeti({ x: 0, y: m.altoMm - s * 0.05, w: m.anchoMm, h: s * 0.04 }, pasteles, Math.round(m.anchoMm / 5), 7, s * 0.014);
      if (tipo === "apertura") {
        const r = Math.min(m.altoMm * 0.045, izq.w * 0.05);
        c += globo(izq.x + s * 0.07, m.altoMm * 0.42, r, "#f6b8b1", "#c9b8a6", 3) + globo(izq.x + s * 0.12, m.altoMm * 0.5, r * 0.8, "#a9d8c8", "#c9b8a6", 3);
        c += globo(izq.x + izq.w - s * 0.07, m.altoMm * 0.45, r * 0.9, "#f8d98f", "#c9b8a6", 3);
      }
      if (tipo === "cierre") c += globo(der.x + der.w - s * 0.06, m.altoMm * 0.5, s * 0.035, "#bfb1e0", "#c9b8a6", 3) + globo(der.x + der.w - s * 0.1, m.altoMm * 0.6, s * 0.028, "#f6b8b1", "#c9b8a6", 3);
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const comba = tipo === "interior-alt" ? s * 0.13 : (tipo === "apertura" || tipo === "cierre" ? s * 0.05 : s * 0.025) * (m.anchoMm / (2 * s)) * 0.5 + s * 0.12;
      return { arriba: comba, abajo: s * 0.05, ...(tipo === "cierre" && l === "der" ? { exterior: s * 0.12 } : {}) };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Poppins", color: "#d07a83", acento: "#6fa995", ejemplos: { ...ejemplos, titulo: "Baby shower de Lucía", subtitulo: "Esperando a Tomás", fecha: "Sábado 14 · 03 · 2026" }, escalaTitulo: 0.08 }),
  },
  {
    id: "embarazo-05-tendedero",
    tema: "embarazo",
    nombre: "Ropita al sol",
    descripcion: "Un tendedero con bodies y meditas sobre papel lino: tierno y con humor.",
    papel: "#f5f0e8",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("g", m, 0.07, 1.2);
      const ropa = [
        { tipo: "body" as const, color: "#a8cbe8", detalle: "#ffffff" },
        { tipo: "media" as const, color: "#f6c1b4", detalle: "#ffffff" },
        { tipo: "body" as const, color: "#f3d68e", detalle: "#ffffff" },
        { tipo: "media" as const, color: "#b9dcc9", detalle: "#ffffff" },
        { tipo: "body" as const, color: "#f6c1b4", detalle: "#ffffff" },
      ];
      let c = fondoLiso(total(m), "#f5f0e8");
      if (tipo === "apertura") {
        const t = Math.min(m.altoMm * 0.13, izq.w * 0.12);
        c += tendedero(izq.x + izq.w * 0.04, izq.x + izq.w * 0.96, m.altoMm * 0.06, m.altoMm * 0.025, ropa, t, "#a08c74");
      } else {
        // En los interiores, una cuerda por página del lado de afuera, con dos o tres prendas.
        const p = tipo === "interior-alt" ? izq : der;
        const t = s * 0.1;
        const x0 = tipo === "interior-alt" ? p.x : p.x + p.w * 0.55;
        const x1 = tipo === "interior-alt" ? p.x + p.w * 0.45 : p.x + p.w;
        c += tendedero(x0, x1, s * 0.035, s * 0.012, tipo === "cierre" ? ropa.slice(0, 2) : tipo === "interior" ? ropa.slice(1, 4) : ropa.slice(2, 5), t, "#a08c74");
      }
      // Pastito de puntadas al pie.
      let pasto = "";
      const rnd = azar(9);
      for (let x = s * 0.01; x < m.anchoMm; x += s * 0.012) {
        const h = s * (0.012 + rnd() * 0.014);
        pasto += `<line x1="${f(x)}" y1="${f(m.altoMm)}" x2="${f(x + (rnd() - 0.5) * s * 0.008)}" y2="${f(m.altoMm - h)}" stroke="${rnd() > 0.5 ? "#b9c9a4" : "#9fb488"}" stroke-width="${f(Math.max(0.3, s * 0.003))}" stroke-linecap="round"/>`;
      }
      c += pasto;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const cuerda = tipo === "interior-alt" ? l === "izq" : tipo !== "apertura" && l === "der";
      return { abajo: s * 0.02, arriba: cuerda ? s * 0.15 : s * 0.02 };
    }),
    textos: textosClasicos({ titulo: "Kalam", texto: "Nunito", color: "#6f5a45", acento: "#d0897a", ejemplos: { ...ejemplos, titulo: "Ya falta poquito", subtitulo: "Nueve meses de espera" }, escalaTitulo: 0.09 }),
  },
  {
    id: "embarazo-06-minimal-linea",
    tema: "embarazo",
    nombre: "Línea fina",
    descripcion: "Blanco puro, un círculo de trazo fino y un punto dorado: minimalista y elegante.",
    papel: "#ffffff",
    margenMm: 20,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const trazo = Math.max(0.3, s * 0.0025);
      let c = fondoLiso(total(m), "#ffffff");
      if (tipo === "apertura") {
        // Un círculo abierto (la panza) con un punto: el bebé.
        const r = Math.min(m.altoMm * 0.09, izq.w * 0.1);
        const cx = izq.x + izq.w / 2;
        const cy = m.altoMm * 0.16;
        c += `<path d="M ${f(cx + r * Math.cos(-1.2))} ${f(cy + r * Math.sin(-1.2))} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r * Math.cos(-0.5))} ${f(cy + r * Math.sin(-0.5))}" stroke="#2f2f2f" stroke-width="${f(trazo)}" fill="none" stroke-linecap="round"/>`;
        c += `<circle cx="${f(cx + r * 0.15)}" cy="${f(cy + r * 0.1)}" r="${f(r * 0.13)}" fill="#c8a45d"/>`;
      }
      // Filete fino sólo en la página de afuera de cada pliego, como paspartú.
      const p = tipo === "interior-alt" ? izq : der;
      if (tipo !== "apertura") c += filete(p, s * 0.035, "#c8a45d", trazo);
      else c += filete(izq, s * 0.035, "#c8a45d", trazo);
      if (tipo === "cierre") c += `<circle cx="${f(der.x + der.w / 2)}" cy="${f(m.altoMm * 0.07)}" r="${f(s * 0.008)}" fill="#c8a45d"/>`;
      return svg(m, c);
    },
    zona: zonaCon(() => ({})),
    textos: textosClasicos({ titulo: "Playfair Display", texto: "Montserrat", color: "#2f2f2f", acento: "#a8853f", ejemplos: { ...ejemplos, titulo: "Cuarenta semanas", subtitulo: "Sofía & Martín" }, escalaTitulo: 0.08 }),
  },
  {
    id: "embarazo-07-flores-silvestres",
    tema: "embarazo",
    nombre: "Flores silvestres",
    descripcion: "Una pradera de florcitas lavanda, amarillas y blancas al pie de cada página.",
    papel: "#fbf8f1",
    margenMm: 13,
    fondo: (tipo, m) => {
      const s = lado(m);
      const rnd = azar(tipo === "interior-alt" ? 41 : 17);
      const alto = s * (tipo === "apertura" || tipo === "cierre" ? 0.16 : 0.1);
      let c = fondoLiso(total(m), "#fbf8f1");
      let tallos = "";
      let flores = "";
      const colores = ["#b9a5d6", "#f2cf73", "#ffffff", "#e9a9b5", "#9c86c4"];
      for (let x = s * 0.01; x < m.anchoMm; x += s * (0.015 + rnd() * 0.02)) {
        const h = alto * (0.35 + rnd() * 0.65);
        const dx = (rnd() - 0.5) * s * 0.03;
        tallos += `<path d="M ${f(x)} ${f(m.altoMm)} Q ${f(x + dx * 0.3)} ${f(m.altoMm - h * 0.5)} ${f(x + dx)} ${f(m.altoMm - h)}" stroke="#93a87e" stroke-width="${f(Math.max(0.25, s * 0.0025))}" fill="none"/>`;
        if (rnd() > 0.35) flores += flor(x + dx, m.altoMm - h, s * (0.009 + rnd() * 0.008), colores[Math.floor(rnd() * colores.length)]!, "#e8b04a", 5, rnd() * 70);
        else tallos += `<ellipse cx="${f(x + dx * 0.6)}" cy="${f(m.altoMm - h * 0.6)}" rx="${f(s * 0.004)}" ry="${f(s * 0.01)}" fill="#a9bc94" transform="rotate(${f((rnd() - 0.5) * 60)} ${f(x + dx * 0.6)} ${f(m.altoMm - h * 0.6)})"/>`;
      }
      c += tallos + flores;
      // Mariposa de dos círculos, chiquita, arriba.
      if (tipo === "apertura") {
        const { izq } = paginas(m);
        const x = izq.x + izq.w / 2;
        const y = m.altoMm * 0.17;
        const r = Math.min(m.altoMm * 0.03, izq.w * 0.035);
        c += `<g transform="translate(${f(x)} ${f(y)}) rotate(-12)"><ellipse cx="${f(-r)}" cy="${f(-r * 0.3)}" rx="${f(r)}" ry="${f(r * 0.8)}" fill="#b9a5d6"/><ellipse cx="${f(r)}" cy="${f(-r * 0.3)}" rx="${f(r)}" ry="${f(r * 0.8)}" fill="#b9a5d6"/><ellipse cx="${f(-r * 0.7)}" cy="${f(r * 0.6)}" rx="${f(r * 0.6)}" ry="${f(r * 0.5)}" fill="#e9a9b5"/><ellipse cx="${f(r * 0.7)}" cy="${f(r * 0.6)}" rx="${f(r * 0.6)}" ry="${f(r * 0.5)}" fill="#e9a9b5"/><rect x="${f(-r * 0.08)}" y="${f(-r * 0.8)}" width="${f(r * 0.16)}" height="${f(r * 1.8)}" rx="${f(r * 0.08)}" fill="#6f5a7e"/></g>`;
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, _l, m) => ({ abajo: lado(m) * (tipo === "apertura" || tipo === "cierre" ? 0.11 : 0.08) })),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Lato", color: "#6c5a86", acento: "#b08a3a", ejemplos: { ...ejemplos, titulo: "Floreciendo" }, escalaTitulo: 0.11 }),
  },
  {
    id: "embarazo-08-botanico-salvia",
    tema: "embarazo",
    nombre: "Botánico salvia",
    descripcion: "Fondo verde salvia con ramas en tono sobre tono y letras crema: sobrio y natural.",
    papel: "#8f9e86",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const fondo = degradado("v", total(m), "#93a28a", "#7f8f77", false);
      const g = grano("g", m, 0.06);
      const k = tipo === "apertura" || tipo === "cierre" ? 1 : 0.7;
      let c = fondo.cuerpo;
      const hoja = "#a9b7a0";
      const hoja2 = "#b8c5ae";
      c += rama(izq.x - s * 0.02, s * 0.12, s * 0.42 * k, -10, hoja, 3, { hojas: 11, anchoHoja: 0.45 });
      c += rama(izq.x + s * 0.02, -s * 0.02, s * 0.32 * k, 40, hoja2, 6, { hojas: 9, anchoHoja: 0.45 });
      c += rama(der.x + der.w + s * 0.02, der.h - s * 0.12, s * 0.42 * k, 170, hoja, 9, { hojas: 11, anchoHoja: 0.45 });
      c += rama(der.x + der.w - s * 0.02, der.h + s * 0.02, s * 0.32 * k, 220, hoja2, 12, { hojas: 9, anchoHoja: 0.45 });
      if (tipo === "apertura") c += filete({ x: izq.x, y: 0, w: izq.w, h: m.altoMm }, s * 0.06, "#efe8d8", Math.max(0.3, s * 0.0025));
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const k = tipo === "apertura" || tipo === "cierre" ? 1 : 0.7;
      return l === "izq" ? { arriba: s * 0.16 * k, exterior: s * 0.05 } : { abajo: s * 0.16 * k, exterior: s * 0.05 };
    }),
    textos: textosClasicos({ titulo: "Allura", texto: "Raleway", color: "#f6f0e2", acento: "#e9dfc6", ejemplos: { ...ejemplos, titulo: "Nuestra dulce espera" }, escalaTitulo: 0.095 }),
  },
  {
    id: "embarazo-09-semana-a-semana",
    tema: "embarazo",
    nombre: "Semana a semana",
    descripcion: "Cuarenta puntos que crecen como la panza, en coral y durazno: moderno y gráfico.",
    papel: "#fdf6ef",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso(total(m), "#fdf6ef");
      // Cuarenta puntos a lo largo del pie del pliego, de chiquitos a grandes.
      const y = m.altoMm - s * 0.05;
      const x0 = izq.x + s * 0.06;
      const x1 = der.x + der.w - s * 0.06;
      const hasta = tipo === "apertura" ? 12 : tipo === "interior" ? 24 : tipo === "interior-alt" ? 32 : 40;
      for (let i = 0; i < 40; i++) {
        const x = x0 + ((x1 - x0) * i) / 39;
        const r = s * (0.003 + (0.012 * i) / 39);
        const lleno = i < hasta;
        c += lleno
          ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${i === 39 ? "#e2725b" : i % 2 ? "#f2a68f" : "#eb8d76"}"/>`
          : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="#efc3b3" stroke-width="${f(Math.max(0.25, s * 0.002))}"/>`;
      }
      if (tipo === "apertura") {
        const r = Math.min(m.altoMm * 0.08, izq.w * 0.09);
        c += `<circle cx="${f(izq.x + izq.w / 2)}" cy="${f(m.altoMm * 0.16)}" r="${f(r)}" fill="#f7d3c4"/><circle cx="${f(izq.x + izq.w / 2 + r * 0.25)}" cy="${f(m.altoMm * 0.16 + r * 0.2)}" r="${f(r * 0.45)}" fill="#eb8d76"/>`;
      }
      // Media luna de color en la esquina de arriba de afuera.
      if (tipo === "interior" || tipo === "cierre") c += `<circle cx="${f(der.x + der.w)}" cy="0" r="${f(s * 0.07)}" fill="#f7d3c4"/>`;
      if (tipo === "interior-alt") c += `<circle cx="${f(izq.x)}" cy="0" r="${f(s * 0.07)}" fill="#f7d3c4"/>`;
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const esquina = ((tipo === "interior" || tipo === "cierre") && l === "der") || (tipo === "interior-alt" && l === "izq");
      return { abajo: s * 0.05, ...(esquina ? { arriba: s * 0.05 } : {}) };
    }),
    textos: textosClasicos({ titulo: "Poppins", texto: "DM Sans", color: "#c75b45", acento: "#7a6a63", ejemplos: { ...ejemplos, titulo: "Semana a semana", subtitulo: "Esperando a Mateo" }, escalaTitulo: 0.085 }),
  },
  {
    id: "embarazo-10-nene-o-nena",
    tema: "embarazo",
    nombre: "¿Nene o nena?",
    descripcion: "Mitad celeste y mitad rosa, nubes y corazones: ideal para la revelación del sexo.",
    papel: "#fdf7f9",
    margenMm: 15,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso(izq, "#e3f0fa") + fondoLiso(der, "#fbe6ec");
      const fuerte = tipo === "apertura" || tipo === "cierre";
      c += bancoDeNubes(izq, s * (fuerte ? 0.1 : 0.07), "#ffffff", 3) + bancoDeNubes(der, s * (fuerte ? 0.1 : 0.07), "#ffffff", 8);
      // Corazones que flotan en la columna de afuera, cada uno del color de la otra página.
      const rnd = azar(tipo === "interior-alt" ? 5 : 2);
      for (let i = 0; i < 4; i++) {
        const y = s * (0.06 + i * 0.11 + rnd() * 0.03);
        c += corazon(izq.x + s * (0.04 + rnd() * 0.03), y, s * (0.012 + rnd() * 0.01), "#f2a7ba", (rnd() - 0.5) * 40, 0.9);
        c += corazon(der.x + der.w - s * (0.04 + rnd() * 0.03), y, s * (0.012 + rnd() * 0.01), "#8fbfe3", (rnd() - 0.5) * 40, 0.9);
      }
      if (tipo === "apertura") {
        const r = Math.min(m.altoMm * 0.06, izq.w * 0.07);
        c += corazon(izq.x + izq.w / 2 - r * 0.45, m.altoMm * 0.16, r, "#8fbfe3", -12) + corazon(izq.x + izq.w / 2 + r * 0.45, m.altoMm * 0.17, r, "#f2a7ba", 12, 0.9);
        c += nube(izq.x + izq.w * 0.22, m.altoMm * 0.12, s * 0.12, "#ffffff") + nube(izq.x + izq.w * 0.8, m.altoMm * 0.23, s * 0.1, "#ffffff");
      }
      if (tipo === "cierre") c += estrella(der.x + der.w / 2, m.altoMm * 0.065, m.altoMm * 0.025, "#f2c46d");
      return svg(m, c);
    },
    zona: zonaCon((tipo, _l, m) => {
      const s = lado(m);
      return { exterior: s * 0.07, abajo: s * (tipo === "apertura" || tipo === "cierre" ? 0.08 : 0.055) };
    }),
    textos: (tipo, m) =>
      textosClasicos({ titulo: "Caveat", texto: "Quicksand", color: tipo === "cierre" ? "#c45f7b" : "#4f86b3", acento: "#d77a94", ejemplos: { ...ejemplos, titulo: "¿Nene o nena?", subtitulo: "Revelación", frase: "¡Bienvenida, Mía!" }, escalaTitulo: 0.12 })(tipo, m),
  },
];
