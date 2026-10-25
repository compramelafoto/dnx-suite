import type { EstiloFotolibro } from "../tipos";
import {
  arco,
  degradado,
  esquineros,
  estrellas,
  filete,
  filtroAcuarela,
  filtroMarmol,
  fondoLiso,
  grano,
  manchaAcuarela,
  olas,
  pampa,
  paginas,
  rama,
  ramoEsquina,
  rosa,
  svg,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

const ejemplos = { titulo: "Ana & Luis", subtitulo: "Nuestra boda", fecha: "14 · 03 · 2026", frase: "Y fueron felices" };

export const BODAS: EstiloFotolibro[] = [
  {
    id: "bodas-01-jardin-acuarela",
    tema: "bodas",
    nombre: "Jardín en acuarela",
    descripcion: "Manchas verde salvia y ramas de eucalipto en las esquinas.",
    papel: "#fbfaf6",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const g = grano("g", m, 0.05);
      const s = Math.min(izq.w, izq.h);
      const fuerte = tipo === "apertura" || tipo === "cierre";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbfaf6");
      c += manchaAcuarela(izq.x + s * 0.08, s * 0.08, s * (fuerte ? 0.32 : 0.2), "#a3b18a", "a", 4);
      c += manchaAcuarela(der.x + der.w - s * 0.08, der.h - s * 0.08, s * (fuerte ? 0.32 : 0.2), "#a3b18a", "a", 9);
      c += ramoEsquina("si", izq.x + s * 0.02, s * 0.02, s * (fuerte ? 0.34 : 0.22), { hoja: "#6b8f71", hoja2: "#8fae8b" }, 21, { redondas: true });
      c += ramoEsquina("id", der.x + der.w - s * 0.02, der.h - s * 0.02, s * (fuerte ? 0.34 : 0.22), { hoja: "#6b8f71", hoja2: "#8fae8b" }, 37, { redondas: true });
      if (tipo === "interior-alt") c += manchaAcuarela(der.x + der.w * 0.9, s * 0.1, s * 0.12, "#d8c3a5", "a", 15, 2);
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: zonaClasica({ arriba: 6, abajo: 6 }),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Lora", color: "#3f4f44", acento: "#6b8f71", ejemplos }),
  },
  {
    id: "bodas-02-blanco-oro",
    tema: "bodas",
    nombre: "Blanco y oro",
    descripcion: "Minimalista, con filete dorado fino y mucho aire.",
    papel: "#ffffff",
    margenMm: 18,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffffff");
      const sep = s * 0.045;
      c += filete(izq, sep, "#c9a54c", 0.35) + filete(der, sep, "#c9a54c", 0.35);
      if (tipo === "apertura" || tipo === "cierre") c += filete(izq, sep * 1.4, "#c9a54c", 0.2) + filete(der, sep * 1.4, "#c9a54c", 0.2);
      return svg(m, c);
    },
    zona: zonaClasica({ arriba: 4, abajo: 4, exterior: 4, interior: 2 }),
    textos: textosClasicos({ titulo: "Allura", texto: "Playfair Display", color: "#9c7a2e", acento: "#7a6a4a", ejemplos }),
  },
  {
    id: "bodas-03-rustico-kraft",
    tema: "bodas",
    nombre: "Rústico kraft",
    descripcion: "Papel kraft con ramitas y un toque de encaje de puntos.",
    papel: "#d9c3a0",
    margenMm: 15,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const fondo = degradado("k", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#dcc6a2", "#cdb48a");
      const g = grano("g", m, 0.16, 1.1);
      let c = fondo.cuerpo;
      c += rama(izq.x + s * 0.04, s * 0.06, s * 0.32, 25, "#5e6b47", 5, { tallo: "#6b4f2a" });
      c += rama(der.x + der.w - s * 0.04, der.h - s * 0.06, s * 0.32, 205, "#5e6b47", 8, { tallo: "#6b4f2a" });
      if (tipo !== "interior") c += rama(izq.x + izq.w * 0.5, izq.h - s * 0.05, s * 0.2, -150, "#7a8a5c", 12, { tallo: "#6b4f2a", redondas: true });
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: zonaClasica({ arriba: 5, abajo: 5 }),
    textos: textosClasicos({ titulo: "Satisfy", texto: "Lora", color: "#4a3520", acento: "#5e6b47", ejemplos }),
  },
  {
    id: "bodas-04-boho-terracota",
    tema: "bodas",
    nombre: "Boho terracota",
    descripcion: "Arcos en tonos tierra y espigas de pampa.",
    papel: "#f6eee5",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f6eee5");
      if (tipo === "apertura") c += arco(izq.x + izq.w / 2, izq.h * 0.92, izq.w * 0.62, izq.h * 0.78, "#e8cfc0");
      c += arco(der.x + der.w * 0.88, der.h, s * 0.18, s * 0.42, "#c97b5a", 0.85);
      c += arco(der.x + der.w * 0.96, der.h, s * 0.12, s * 0.3, "#e3a587", 0.9);
      c += pampa(izq.x + s * 0.02, izq.h * 0.98, s * 0.42, -70, "#b98b62", 3);
      c += pampa(izq.x + s * 0.06, izq.h * 0.99, s * 0.34, -55, "#d1ab84", 6);
      if (tipo === "interior-alt" || tipo === "cierre") c += pampa(der.x + der.w * 0.98, s * 0.02, s * 0.3, 120, "#d1ab84", 9);
      return svg(m, c);
    },
    zona: zonaClasica({ abajo: 8, exterior: 6 }),
    textos: textosClasicos({ titulo: "Sacramento", texto: "Raleway", color: "#8a4b33", acento: "#b06a4b", ejemplos }),
  },
  {
    id: "bodas-05-noche-estrellada",
    tema: "bodas",
    nombre: "Noche estrellada",
    descripcion: "Azul noche con estrellas doradas, para fiestas de noche.",
    papel: "#14213d",
    margenMm: 15,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("n", total, "#0f1a33", "#1f2f55");
      const densidad = tipo === "apertura" || tipo === "cierre" ? 220 : 90;
      return svg(m, fondo.cuerpo + estrellas(total, "#e7c873", Math.round((densidad * m.anchoMm) / 600), 31, Math.min(m.altoMm, 300) * 0.012), fondo.defs);
    },
    zona: zonaClasica(),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Montserrat", color: "#e7c873", acento: "#f1e6c8", ejemplos }),
  },
  {
    id: "bodas-06-rosas-empolvadas",
    tema: "bodas",
    nombre: "Rosas empolvadas",
    descripcion: "Rosas en rosa viejo y hojas en las esquinas.",
    papel: "#fdf7f6",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const k = tipo === "apertura" || tipo === "cierre" ? 1 : 0.7;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdf7f6");
      const ramo = (x: number, y: number, esq: "si" | "id", sem: number) =>
        ramoEsquina(esq, x, y, s * 0.3 * k, { hoja: "#8a9e86", hoja2: "#b5c4b1" }, sem) +
        rosa(x + (esq === "si" ? 1 : -1) * s * 0.07 * k, y + (esq === "si" ? 1 : -1) * s * 0.06 * k, s * 0.055 * k, "#e8b4b8", "#c98a90", 20) +
        rosa(x + (esq === "si" ? 1 : -1) * s * 0.15 * k, y + (esq === "si" ? 1 : -1) * s * 0.025 * k, s * 0.04 * k, "#f2cfd1", "#d9a3a8", 70);
      c += ramo(izq.x + s * 0.02, s * 0.02, "si", 3) + ramo(der.x + der.w - s * 0.02, der.h - s * 0.02, "id", 7);
      return svg(m, c);
    },
    zona: zonaClasica({ arriba: 6, abajo: 6 }),
    textos: textosClasicos({ titulo: "Allura", texto: "Lora", color: "#8c5a60", acento: "#a77c80", ejemplos }),
  },
  {
    id: "bodas-07-marmol",
    tema: "bodas",
    nombre: "Mármol",
    descripcion: "Mármol blanco con vetas grises y filete champaña.",
    papel: "#f4f3f1",
    margenMm: 17,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f4f3f1");
      c += `<rect width="${m.anchoMm}" height="${m.altoMm}" filter="url(#mm)" opacity="${tipo === "interior" ? 0.45 : 0.7}"/>`;
      c += filete(izq, s * 0.05, "#bfa77a", 0.3) + filete(der, s * 0.05, "#bfa77a", 0.3);
      return svg(m, c, filtroMarmol("mm"));
    },
    zona: zonaClasica({ arriba: 4, abajo: 4, exterior: 3 }),
    textos: textosClasicos({ titulo: "Tangerine", texto: "Montserrat", color: "#5b5446", acento: "#8f7d55", ejemplos, escalaTitulo: 0.13 }),
  },
  {
    id: "bodas-08-clasico-marfil",
    tema: "bodas",
    nombre: "Clásico marfil",
    descripcion: "Marfil con doble filete y esquineros, como un álbum de siempre.",
    papel: "#f8f1e3",
    margenMm: 18,
    fondo: (_tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f8f1e3");
      for (const p of [izq, der]) {
        c += filete(p, s * 0.04, "#a08453", 0.45) + filete(p, s * 0.052, "#a08453", 0.2) + esquineros(p, s * 0.065, s * 0.06, "#a08453", 0.35);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaClasica({ arriba: 5, abajo: 5, exterior: 4, interior: 2 }),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Libre Baskerville", color: "#6e5530", acento: "#8a6d3b", ejemplos }),
  },
  {
    id: "bodas-09-destino-playa",
    tema: "bodas",
    nombre: "Boda en la playa",
    descripcion: "Arena clara y olas suaves en turquesa, para bodas de destino.",
    papel: "#fbf6ec",
    margenMm: 15,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const alto = m.altoMm * (tipo === "apertura" || tipo === "cierre" ? 0.16 : 0.08);
      return svg(m, fondoLiso(total, "#fbf6ec") + olas(total, alto, ["#cfe9e5", "#9fd3cc", "#6fbcb3"], 5));
    },
    // En la página del título, la ola reserva menos: ya está el título arriba.
    zona: (tipo, lado, m) => {
      const titulo = (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
      return { ...zonaClasica()(tipo, lado, m), abajo: m.altoMm * (titulo ? 0.05 : tipo === "apertura" || tipo === "cierre" ? 0.12 : 0.06) };
    },
    textos: textosClasicos({ titulo: "Satisfy", texto: "Quicksand", color: "#2f6f6a", acento: "#4f9a92", ejemplos }),
  },
  {
    id: "bodas-10-moderno-oliva",
    tema: "bodas",
    nombre: "Moderno oliva",
    descripcion: "Bloques de color oliva y arena, líneas finas y tipografía moderna.",
    papel: "#f5f1e8",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f5f1e8");
      if (tipo === "apertura") c += fondoLiso({ x: izq.x, y: 0, w: izq.w, h: izq.h }, "#6b705c");
      else if (tipo === "interior-alt") c += fondoLiso({ x: der.x + der.w * 0.82, y: 0, w: der.w * 0.18, h: der.h }, "#cb997e");
      else if (tipo === "cierre") c += fondoLiso({ x: der.x, y: 0, w: der.w, h: der.h * 0.3 }, "#6b705c");
      c += `<line x1="${izq.x + izq.w * 0.06}" y1="${izq.h * 0.94}" x2="${izq.x + izq.w * 0.4}" y2="${izq.h * 0.94}" stroke="#a5a58d" stroke-width="0.4"/>`;
      return svg(m, c);
    },
    zona: (tipo, lado, m) =>
      tipo === "interior-alt" && lado === "der" ? { exterior: (m.anchoMm / 2) * 0.18 } : zonaClasica()(tipo, lado, m),
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Playfair Display",
        texto: "Poppins",
        color: tipo === "apertura" || tipo === "cierre" ? "#f5f1e8" : "#3d405b",
        acento: "#ddbea9",
        ejemplos,
        escalaTitulo: 0.08,
      })(tipo, m),
  },
];

