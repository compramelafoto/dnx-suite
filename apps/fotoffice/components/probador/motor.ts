import {
  aLaPared,
  COMPOSICIONES,
  cuadrosDe,
  esquinasDeReferencia,
  homografia,
  invertir,
  MEDIDAS,
  medidaDelConjunto,
  proyectar,
  type ComposicionId,
  type Homografia,
  type Punto,
  type Rect,
} from "@/lib/probador/geometria";

/**
 * El motor del probador: dibuja la foto de la pared con los cuadros encima y atiende el arrastre.
 * Es imperativo a propósito — todo pasa en un `<canvas>` que se redibuja en cada movimiento del
 * dedo, y pasar eso por el estado de React haría re-renderizar el panel entero 60 veces por segundo.
 *
 * Los cuadros se arman primero "de frente", en una capa en cm (`armarCapa`), y después esa capa
 * se proyecta sobre la foto con la homografía de la pared. La proyección se hace con WebGL
 * (perspectiva exacta, sin costuras); si el navegador no lo tiene, se aproxima con triángulos.
 *
 * Nada sale del navegador: las fotos del cliente se leen con `URL.createObjectURL` y no se suben.
 */

type Marco = { label: string; base?: readonly [number, number, number]; w: number; vetas?: boolean; metal?: boolean; lienzo?: boolean };
const MARCOS: Record<string, Marco> = {
  negro: { label: "Negro", base: [30, 30, 32], w: 2.5 },
  blanco: { label: "Blanco", base: [240, 238, 233], w: 2.5 },
  roble: { label: "Roble", base: [184, 136, 86], w: 3, vetas: true },
  nogal: { label: "Nogal", base: [92, 60, 38], w: 3, vetas: true },
  dorado: { label: "Dorado", base: [186, 147, 64], w: 3, metal: true },
  aluminio: { label: "Aluminio", base: [170, 174, 179], w: 1.5, metal: true },
  lienzo: { label: "Lienzo", w: 0, lienzo: true },
};

type Foto = { img: HTMLCanvasElement; thumb: string };
type Capa = { canvas: HTMLCanvasElement; k: number; m: number; bw: number; bh: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
const rgb = (c: readonly number[], s: number) =>
  `rgb(${clamp(c[0] * s, 0, 255) | 0},${clamp(c[1] * s, 0, 255) | 0},${clamp(c[2] * s, 0, 255) | 0})`;
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-AR");

/** Azar con semilla: el living y las fotos de muestra salen siempre iguales. */
function azar(semilla: number) {
  return () => {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lienzo(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}

/* ---------- Living de ejemplo ---------- */
function livingDeEjemplo() {
  const W = 1800, H = 1200, { c, g } = lienzo(W, H);
  const quad: Punto[] = [{ x: 250, y: 120 }, { x: 1610, y: 175 }, { x: 1610, y: 885 }, { x: 250, y: 945 }];
  const RW = 380, RH = 260, Hm = homografia(esquinasDeReferencia(RW, RH), quad)!;
  const P = (x: number, y: number) => proyectar(Hm, x, y);
  const poly = (pts: (Punto | [number, number])[], fill: string | CanvasGradient) => {
    g.beginPath();
    pts.forEach((p, i) => { const q = Array.isArray(p) ? P(p[0], p[1]) : p; if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
    g.closePath(); g.fillStyle = fill; g.fill();
  };
  const linea = (a: Punto, b: Punto) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  g.fillStyle = "#ebe8e2"; g.fillRect(0, 0, W, H);
  let gr = g.createLinearGradient(0, 0, 250, 0); gr.addColorStop(0, "#bfb7aa"); gr.addColorStop(1, "#d2cabe");
  poly([{ x: 0, y: 0 }, quad[0], quad[3], { x: 0, y: 1110 }], gr);
  gr = g.createLinearGradient(1610, 0, 1800, 0); gr.addColorStop(0, "#cbc4b8"); gr.addColorStop(1, "#bdb5a8");
  poly([quad[1], { x: 1800, y: 140 }, { x: 1800, y: 965 }, quad[2]], gr);
  gr = g.createLinearGradient(0, 880, 0, H); gr.addColorStop(0, "#94704f"); gr.addColorStop(1, "#6b4d34");
  poly([{ x: 0, y: 1110 }, quad[3], quad[2], { x: 1800, y: 965 }, { x: 1800, y: H }, { x: 0, y: H }], gr);
  g.strokeStyle = "rgba(40,25,12,.28)"; g.lineWidth = 2;
  const fuga = { x: 930, y: 520 };
  for (let t = 0; t <= 1.0001; t += 1 / 14) {
    const a = { x: quad[3].x + (quad[2].x - quad[3].x) * t, y: quad[3].y + (quad[2].y - quad[3].y) * t };
    linea(a, { x: a.x + (a.x - fuga.x) * 3, y: a.y + (a.y - fuga.y) * 3 });
  }
  gr = g.createLinearGradient(250, 0, 1610, 0); gr.addColorStop(0, "#ebe5da"); gr.addColorStop(1, "#d3ccc0");
  poly(quad, gr);
  g.save(); g.beginPath(); quad.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.clip();
  const luz = g.createRadialGradient(520, 330, 40, 520, 330, 700);
  luz.addColorStop(0, "rgba(255,250,238,.45)"); luz.addColorStop(1, "rgba(255,250,238,0)");
  g.fillStyle = luz; g.fillRect(0, 0, W, H); g.restore();
  poly([[0, 250], [RW, 250], [RW, RH], [0, RH]], "#f3f1ec");
  g.strokeStyle = "rgba(0,0,0,.12)"; linea(P(0, 250), P(RW, 250));
  g.save(); g.shadowColor = "rgba(30,22,14,.45)"; g.shadowBlur = 60; g.shadowOffsetY = 10;
  poly([[66, 178], [304, 178], [304, 258], [66, 258]], "rgba(60,50,40,.35)"); g.restore();
  poly([[72, 172], [298, 172], [298, 222], [72, 222]], "#435c63");
  poly([[72, 214], [298, 214], [298, 246], [72, 246]], "#4d6870");
  g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 3;
  [148, 223].forEach((x) => linea(P(x, 176), P(x, 244)));
  linea(P(72, 214), P(298, 214));
  poly([[60, 196], [80, 196], [80, 248], [60, 248]], "#3f575e");
  poly([[290, 196], [310, 196], [310, 248], [290, 248]], "#3f575e");
  poly([[78, 246], [86, 246], [86, 259], [78, 259]], "#3a2a1c");
  poly([[284, 246], [292, 246], [292, 259], [284, 259]], "#3a2a1c");
  poly([[92, 182], [134, 186], [132, 214], [90, 212]], "#c9a66b");
  poly([[238, 186], [280, 182], [282, 212], [240, 214]], "#d9d2c5");
  poly([[326, 224], [354, 224], [351, 260], [329, 260]], "#d8d2c7");
  const r = azar(7);
  for (let i = 0; i < 22; i++) {
    const cx = 340 + (r() - 0.5) * 44, cy = 150 + r() * 72, p = P(cx, cy), sc = P(cx + 6, cy).x - p.x;
    g.save(); g.translate(p.x, p.y); g.rotate((r() - 0.5) * 2.2); g.fillStyle = i % 3 ? "#4e7a49" : "#3a6136";
    g.beginPath(); g.ellipse(0, 0, sc * 1.1, sc * 0.38, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.strokeStyle = "#2c2a27"; g.lineWidth = 7; linea(P(26, 258), P(26, 108));
  poly([[12, 82], [40, 82], [46, 110], [6, 110]], "#efe6d2");
  const lp = P(26, 112), brillo = g.createRadialGradient(lp.x, lp.y, 10, lp.x, lp.y, 260);
  brillo.addColorStop(0, "rgba(255,236,190,.35)"); brillo.addColorStop(1, "rgba(255,236,190,0)");
  g.fillStyle = brillo; g.fillRect(0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), d = id.data, rn = azar(3);
  for (let i = 0; i < d.length; i += 4) { const n = (rn() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  return { canvas: c, quad, RW, RH };
}

/* ---------- Fotos de muestra (paisajes generados) ---------- */
type Paleta = { sky: string[]; sun?: string; hills: string[]; water?: boolean; stars?: boolean };
const PALETAS: Paleta[] = [
  { sky: ["#22304f", "#c76b5b", "#f2b880"], sun: "#ffe2b0", hills: ["#4a3b52", "#33293d", "#1d1724"] },
  { sky: ["#86b2d6", "#cfe3ee", "#f4efe4"], sun: "#fff6dc", hills: ["#7d97a8", "#5b7688", "#3a5568"], water: true },
  { sky: ["#e3ad66", "#f3d3a1", "#f8e9cf"], sun: "#fff1d0", hills: ["#c98a52", "#a8653a", "#7b4426"] },
  { sky: ["#b9c4bc", "#d9dfd8", "#eef0ea"], hills: ["#8a9e93", "#5f776b", "#344b41"] },
  { sky: ["#0d1630", "#1e2c55", "#3a4f80"], sun: "#f1f0e6", hills: ["#18213d", "#0e152b", "#070b19"], stars: true },
  { sky: ["#5d4a7a", "#b48bb5", "#f0c9c3"], sun: "#ffe9de", hills: ["#6b5a86", "#4c3f66", "#2e2645"], water: true },
  { sky: ["#6fa7dc", "#b7d7ef", "#e4f0f6"], hills: ["#a3c46f", "#729c47", "#3f6b2c"] },
  { sky: ["#c9663a", "#efb36b", "#f6deb0"], sun: "#fff3d6", hills: ["#9a4a2a", "#6e3020", "#3f1b14"] },
  { sky: ["#3b3b3b", "#9a9a9a", "#e6e6e6"], sun: "#ffffff", hills: ["#6a6a6a", "#444444", "#222222"], water: true },
];
function fotoDeMuestra(i: number) {
  const p = PALETAS[i % PALETAS.length], vertical = i % 3 === 1, W = vertical ? 900 : 1200, H = vertical ? 1200 : 900;
  const { c, g } = lienzo(W, H), r = azar(100 + i), horizonte = H * (p.water ? 0.62 : 0.72);
  let gr = g.createLinearGradient(0, 0, 0, horizonte);
  p.sky.forEach((s, k) => gr.addColorStop(k / (p.sky.length - 1), s));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (p.stars) {
    g.fillStyle = "rgba(255,255,255,.8)";
    for (let k = 0; k < 140; k++) { g.beginPath(); g.arc(r() * W, r() * horizonte * 0.8, r() * 1.8 + 0.3, 0, 7); g.fill(); }
  }
  if (p.sun) {
    const sx = W * (0.25 + r() * 0.5), sy = horizonte * (0.45 + r() * 0.3), sr = Math.min(W, H) * 0.07;
    const halo = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 5);
    halo.addColorStop(0, p.sun + "aa"); halo.addColorStop(1, p.sun + "00");
    g.fillStyle = halo; g.fillRect(0, 0, W, H); g.fillStyle = p.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  }
  p.hills.forEach((col, L) => {
    const base = horizonte - (2 - L) * H * 0.07, amp = H * (0.05 + 0.04 * (2 - L)), f1 = 1 + r() * 2, f2 = 3 + r() * 3, ph = r() * 6;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const t = x / W;
      g.lineTo(x, base - amp * (Math.sin(t * f1 * Math.PI + ph) * 0.6 + Math.sin(t * f2 * Math.PI + ph * 2) * 0.3 + 0.5));
    }
    g.lineTo(W, H); g.closePath(); g.fillStyle = col; g.fill();
  });
  if (p.water) {
    gr = g.createLinearGradient(0, horizonte, 0, H); gr.addColorStop(0, p.sky[2]); gr.addColorStop(1, p.sky[0]);
    g.fillStyle = gr; g.fillRect(0, horizonte, W, H - horizonte);
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 2;
    for (let k = 0; k < 40; k++) {
      const y = horizonte + Math.pow(r(), 1.6) * (H - horizonte), x = r() * W, l = 20 + r() * 120;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
    }
  }
  const vi = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vi.addColorStop(0, "rgba(0,0,0,0)"); vi.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = vi; g.fillRect(0, 0, W, H);
  return c;
}
function miniatura(c: HTMLCanvasElement) {
  const s = 160 / Math.max(c.width, c.height), t = lienzo(Math.round(c.width * s), Math.round(c.height * s));
  t.g.drawImage(c, 0, 0, t.c.width, t.c.height);
  return t.c.toDataURL("image/jpeg", 0.8);
}
function vetas() {
  const { c, g } = lienzo(400, 60), r = azar(11);
  for (let k = 0; k < 70; k++) {
    const y = r() * 60;
    g.strokeStyle = r() < 0.5 ? "rgba(60,30,10,.5)" : "rgba(255,230,190,.35)"; g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 400; x += 20) g.lineTo(x, y + Math.sin(x / 60 + k) * 2.2); g.stroke();
  }
  return c;
}

/** Lee una imagen elegida por el cliente y la achica a `max` px de lado. Nada se sube. */
function leerArchivo(file: File, max: number): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const { c, g } = lienzo(Math.round(im.naturalWidth * s), Math.round(im.naturalHeight * s));
      g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagen ilegible")); };
    im.src = url;
  });
}

/* ---------- Proyección con WebGL ---------- */
type Gl = { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; tex: WebGLTexture; u: Record<string, WebGLUniformLocation | null> };
function iniciarGl(): Gl | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true, antialias: false });
    if (!gl) return null;
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat3 Hi;uniform vec2 origin;uniform float k;uniform vec2 size;uniform float viewH;uniform float alpha;uniform sampler2D tex;
void main(){vec2 px=vec2(gl_FragCoord.x,viewH-gl_FragCoord.y);vec3 q=Hi*vec3(px,1.);if(q.z<=0.)discard;
vec2 uv=(q.xy/q.z-origin)*k/size;if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)discard;gl_FragColor=texture2D(tex,uv)*alpha;}`;
    const sh = (t: number, s: string) => {
      const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? "shader");
      return o;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u: Gl["u"] = {};
    for (const n of ["Hi", "origin", "k", "size", "viewH", "alpha", "tex"]) u[n] = gl.getUniformLocation(prog, n);
    const tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return { gl, canvas, tex, u };
  } catch {
    return null;
  }
}

/**
 * Monta el probador sobre el marcado de `ProbadorCuadros` (los elementos con `data-pdc`).
 * Devuelve la función que lo desmonta.
 */
export function montarProbador(raiz: HTMLElement): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(n: string) => raiz.querySelector<T>(`[data-pdc="${n}"]`)!;
  const cv = $<HTMLCanvasElement>("lienzo"), ctx = cv.getContext("2d")!;
  const VETAS = vetas();
  const gl = iniciarGl();

  const S = {
    pared: null as HTMLCanvasElement | null, quad: [] as Punto[], refW: 380, refH: 260, piso: true,
    composicion: "triptico" as ComposicionId, medida: 3, orient: "v", sep: 5, marco: "negro", paspartu: 6, repartida: false,
    fotos: [] as Foto[], deMuestra: true, fotoDe: [] as (number | undefined)[], giro: 0, sel: -1,
    gx: 185, gy: 115, modo: "ubicar" as "pared" | "ubicar",
    H: null as Homografia | null, Hi: null as Homografia | null, capa: null as Capa | null,
    cuadros: [] as Rect[], bw: 0, bh: 0,
  };

  function recalcularH() {
    const H = homografia(esquinasDeReferencia(S.refW, S.refH), S.quad);
    if (H) { S.H = H; S.Hi = invertir(H); }
  }
  function cuadrosActuales() {
    const [a, b] = MEDIDAS[S.medida], w = S.orient === "v" ? a : b, h = S.orient === "v" ? b : a;
    S.cuadros = cuadrosDe(S.composicion, w, h, S.sep);
    const m = medidaDelConjunto(S.cuadros); S.bw = m.w; S.bh = m.h;
  }
  function indiceDeFoto(i: number) {
    const n = S.fotos.length; if (!n) return -1;
    const v = S.fotoDe[i];
    return v == null || v >= n ? (i + S.giro) % n : v;
  }

  /* ---- Capa de cuadros, de frente y en cm ---- */
  function dibujarFoto(c: CanvasRenderingContext2D, src: HTMLCanvasElement | undefined, rect: Rect, union: Rect | null) {
    if (!src) { c.fillStyle = "#c9cdca"; c.fillRect(rect.x, rect.y, rect.w, rect.h); return; }
    const iw = src.width, ih = src.height;
    if (union) {
      const s = Math.max(union.w / iw, union.h / ih), ox = union.x + (union.w - iw * s) / 2, oy = union.y + (union.h - ih * s) / 2;
      c.drawImage(src, (rect.x - ox) / s, (rect.y - oy) / s, rect.w / s, rect.h / s, rect.x, rect.y, rect.w, rect.h);
    } else {
      const ra = rect.w / rect.h, ia = iw / ih;
      let sw = iw, sh = ih;
      if (ia > ra) sw = ih * ra; else sh = iw / ra;
      c.drawImage(src, (iw - sw) / 2, (ih - sh) / 2, sw, sh, rect.x, rect.y, rect.w, rect.h);
    }
  }
  function dibujarCuadro(c: CanvasRenderingContext2D, s: Rect, i: number, k: number, union: Rect) {
    const st = MARCOS[S.marco], fw = st.w, pp = st.lienzo ? 0 : S.paspartu, { x, y, w, h } = s;
    // sombra en la pared: una lejana y una de contacto
    c.save(); c.shadowColor = "rgba(25,18,10,.34)"; c.shadowBlur = (st.lienzo ? 2.2 : 1.6) * k;
    c.shadowOffsetX = 0.5 * k; c.shadowOffsetY = (st.lienzo ? 1.8 : 1.3) * k; c.fillStyle = "#222"; c.fillRect(x, y, w, h); c.restore();
    c.save(); c.shadowColor = "rgba(25,18,10,.35)"; c.shadowBlur = 0.35 * k; c.shadowOffsetY = 0.18 * k; c.fillStyle = "#222"; c.fillRect(x, y, w, h); c.restore();
    const src = S.fotos[indiceDeFoto(S.repartida ? 0 : i)]?.img;
    if (st.lienzo) {
      dibujarFoto(c, src, s, S.repartida ? union : null);
      const e = Math.min(w, h) * 0.04;
      let gr = c.createLinearGradient(x + w - e, 0, x + w, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.22)");
      c.fillStyle = gr; c.fillRect(x + w - e, y, e, h);
      gr = c.createLinearGradient(0, y + h - e, 0, y + h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.25)");
      c.fillStyle = gr; c.fillRect(x, y + h - e, w, e);
      return;
    }
    const base = st.base!;
    const inner = { x: x + fw, y: y + fw, w: w - 2 * fw, h: h - 2 * fw };
    const foto = { x: inner.x + pp, y: inner.y + pp, w: inner.w - 2 * pp, h: inner.h - 2 * pp };
    if (pp > 0) { c.fillStyle = "#f6f4ef"; c.fillRect(inner.x, inner.y, inner.w, inner.h); }
    if (foto.w > 0 && foto.h > 0) {
      dibujarFoto(c, src, foto, S.repartida ? union : null);
      if (pp > 0) { // corte en bisel del paspartú
        const b = 0.35;
        c.fillStyle = "#e4ded2"; c.fillRect(foto.x - b, foto.y - b, foto.w + 2 * b, b); c.fillRect(foto.x - b, foto.y, b, foto.h);
        c.fillStyle = "#fffdf8"; c.fillRect(foto.x, foto.y + foto.h, foto.w + b, b); c.fillRect(foto.x + foto.w, foto.y - b, b, foto.h + b);
      }
    }
    let gr = c.createLinearGradient(0, inner.y, 0, inner.y + 1.2); gr.addColorStop(0, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr; c.fillRect(inner.x, inner.y, inner.w, 1.2);
    gr = c.createLinearGradient(inner.x, 0, inner.x + 0.9, 0); gr.addColorStop(0, "rgba(0,0,0,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr; c.fillRect(inner.x, inner.y, 0.9, inner.h);
    c.save(); c.beginPath(); c.rect(inner.x, inner.y, inner.w, inner.h); c.clip();
    gr = c.createLinearGradient(inner.x, inner.y, inner.x + inner.w * 0.6, inner.y + inner.h * 0.6);
    gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(0.45, "rgba(255,255,255,.03)"); gr.addColorStop(0.46, "rgba(255,255,255,0)");
    c.fillStyle = gr; c.fillRect(inner.x, inner.y, inner.w, inner.h); c.restore();
    // los cuatro lados, a inglete, con la luz desde arriba a la izquierda
    const o = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as const;
    const n = [[x + fw, y + fw], [x + w - fw, y + fw], [x + w - fw, y + h - fw], [x + fw, y + h - fw]] as const;
    const lados = [[0, 1, 1.14, false], [1, 2, 0.84, true], [2, 3, 0.72, false], [3, 0, 1.03, true]] as const;
    for (const [a, b, sh, vertical] of lados) {
      c.beginPath(); c.moveTo(o[a][0], o[a][1]); c.lineTo(o[b][0], o[b][1]); c.lineTo(n[b][0], n[b][1]); c.lineTo(n[a][0], n[a][1]); c.closePath();
      if (st.metal) {
        const lg = c.createLinearGradient((o[a][0] + o[b][0]) / 2, (o[a][1] + o[b][1]) / 2, (n[a][0] + n[b][0]) / 2, (n[a][1] + n[b][1]) / 2);
        lg.addColorStop(0, rgb(base, sh * 1.25)); lg.addColorStop(0.45, rgb(base, sh * 0.92)); lg.addColorStop(1, rgb(base, sh * 1.12));
        c.fillStyle = lg;
      } else c.fillStyle = rgb(base, sh);
      c.fill();
      if (st.vetas) {
        const pat = c.createPattern(VETAS, "repeat");
        if (pat) {
          const m = new DOMMatrix(); if (vertical) m.rotateSelf(90); m.scaleSelf(0.05); pat.setTransform(m);
          c.save(); c.clip(); c.globalAlpha = 0.55; c.fillStyle = pat; c.fill(); c.restore();
        }
      }
    }
    c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 0.12; c.strokeRect(x + 0.06, y + 0.06, w - 0.12, h - 0.12);
  }
  function armarCapa() {
    cuadrosActuales();
    const q = S.quad;
    const ppc = Math.max(dist(q[0], q[1]) / S.refW, dist(q[3], q[2]) / S.refW, dist(q[0], q[3]) / S.refH, dist(q[1], q[2]) / S.refH);
    const m = 8;
    const k = Math.min(clamp(ppc * 1.15, 1.5, 14), 4096 / (S.bw + 2 * m), 4096 / (S.bh + 2 * m));
    const { c, g } = lienzo(Math.ceil((S.bw + 2 * m) * k), Math.ceil((S.bh + 2 * m) * k));
    g.scale(k, k); g.translate(m, m);
    const union = { x: 0, y: 0, w: S.bw, h: S.bh };
    S.cuadros.forEach((s, i) => dibujarCuadro(g, s, i, k, union));
    S.capa = { canvas: c, k, m, bw: S.bw, bh: S.bh };
    if (gl) {
      gl.gl.bindTexture(gl.gl.TEXTURE_2D, gl.tex);
      gl.gl.pixelStorei(gl.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.gl.texImage2D(gl.gl.TEXTURE_2D, 0, gl.gl.RGBA, gl.gl.RGBA, gl.gl.UNSIGNED_BYTE, c);
    }
  }

  /* ---- Proyección de la capa sobre la foto ---- */
  type Vertice = { u: number; v: number; x: number; y: number };
  function triangulo(img: HTMLCanvasElement, s0: Vertice, s1: Vertice, s2: Vertice) {
    const cx = (s0.x + s1.x + s2.x) / 3, cy = (s0.y + s1.y + s2.y) / 3;
    const ex = (p: Vertice): [number, number] => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return [p.x + (dx / l) * 0.5, p.y + (dy / l) * 0.5]; };
    ctx.save(); ctx.beginPath(); ctx.moveTo(...ex(s0)); ctx.lineTo(...ex(s1)); ctx.lineTo(...ex(s2)); ctx.closePath(); ctx.clip();
    const ax = s1.u - s0.u, ay = s1.v - s0.v, bx = s2.u - s0.u, by = s2.v - s0.v, det = ax * by - bx * ay;
    if (!det) { ctx.restore(); return; }
    const c1 = s1.x - s0.x, c2 = s1.y - s0.y, e1 = s2.x - s0.x, e2 = s2.y - s0.y;
    const m11 = (c1 * by - e1 * ay) / det, m12 = (-c1 * bx + e1 * ax) / det, m21 = (c2 * by - e2 * ay) / det, m22 = (-c2 * bx + e2 * ax) / det;
    ctx.setTransform(m11, m21, m12, m22, s0.x - (m11 * s0.u + m12 * s0.v), s0.y - (m21 * s0.u + m22 * s0.v));
    const x0 = Math.max(0, Math.min(s0.u, s1.u, s2.u) - 1), y0 = Math.max(0, Math.min(s0.v, s1.v, s2.v) - 1);
    const x1 = Math.min(img.width, Math.max(s0.u, s1.u, s2.u) + 1), y1 = Math.min(img.height, Math.max(s0.v, s1.v, s2.v) + 1);
    if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
  function proyectarCapa(alpha: number) {
    const L = S.capa; if (!L || !S.H || !S.Hi) return;
    const ox = S.gx - L.bw / 2 - L.m, oy = S.gy - L.bh / 2 - L.m;
    if (gl) {
      const g = gl.gl;
      if (gl.canvas.width !== cv.width || gl.canvas.height !== cv.height) { gl.canvas.width = cv.width; gl.canvas.height = cv.height; }
      g.viewport(0, 0, gl.canvas.width, gl.canvas.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      const h = S.Hi;
      g.uniformMatrix3fv(gl.u.Hi, false, new Float32Array([h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]));
      g.uniform2f(gl.u.origin, ox, oy); g.uniform1f(gl.u.k, L.k); g.uniform2f(gl.u.size, L.canvas.width, L.canvas.height);
      g.uniform1f(gl.u.viewH, gl.canvas.height); g.uniform1f(gl.u.alpha, alpha); g.uniform1i(gl.u.tex, 0);
      g.drawArrays(g.TRIANGLES, 0, 6);
      ctx.drawImage(gl.canvas, 0, 0);
      return;
    }
    const N = arrastre ? 10 : 22, Wd = L.canvas.width, Hd = L.canvas.height, pts: (Vertice & { ok: boolean })[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = (i / N) * Wd, v = (j / N) * Hd, p = proyectar(S.H, ox + u / L.k, oy + v / L.k);
      pts.push({ u, v, x: p.x, y: p.y, ok: p.w > 0 });
    }
    ctx.globalAlpha = alpha;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = pts[j * (N + 1) + i], b = pts[j * (N + 1) + i + 1], c = pts[(j + 1) * (N + 1) + i + 1], d = pts[(j + 1) * (N + 1) + i];
      if (!(a.ok && b.ok && c.ok && d.ok)) continue;
      triangulo(L.canvas, a, b, c); triangulo(L.canvas, a, c, d);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Dibujo en pantalla ---- */
  let raf = 0, rearmar = true;
  let arrastre: { tipo: "esquina"; i: number } | { tipo: "conjunto"; desde: Punto; g0: Punto } | null = null;
  const escala = () => { const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; };
  const acento = () => getComputedStyle(raiz).getPropertyValue("--pdc-accent").trim() || "#2b6a5f";
  function pedir(capa: boolean) {
    if (capa) rearmar = true;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; dibujar(false); });
  }
  function dibujar(limpio: boolean) {
    if (!S.pared || !S.H) return;
    if (cv.width !== S.pared.width || cv.height !== S.pared.height) { cv.width = S.pared.width; cv.height = S.pared.height; }
    if (rearmar) { armarCapa(); rearmar = false; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(S.pared, 0, 0);
    proyectarCapa(!limpio && S.modo === "pared" ? 0.55 : 1);
    if (!limpio) guias();
    medidas();
  }
  function linea(a: Punto, b: Punto) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function guias() {
    const H = S.H!, f = escala(), ac = acento();
    if (S.modo === "pared") {
      ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = f;
      for (let x = 50; x < S.refW; x += 50) linea(proyectar(H, x, 0), proyectar(H, x, S.refH));
      for (let y = 50; y < S.refH; y += 50) linea(proyectar(H, 0, y), proyectar(H, S.refW, y));
      ctx.strokeStyle = ac; ctx.lineWidth = 2.5 * f; ctx.beginPath();
      S.quad.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke();
      ctx.font = `600 ${13 * f}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const etiqueta = (p: Punto, t: string) => {
        const w = ctx.measureText(t).width + 12 * f;
        ctx.fillStyle = ac; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 11 * f, w, 22 * f, 6 * f); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(t, p.x, p.y + 0.5 * f);
      };
      const arriba = proyectar(H, S.refW / 2, 0), izq = proyectar(H, 0, S.refH / 2);
      etiqueta({ x: arriba.x, y: arriba.y - 20 * f }, `${S.refW} cm`);
      etiqueta({ x: izq.x + 34 * f, y: izq.y }, `${S.refH} cm`);
      for (const q of S.quad) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = ac; ctx.lineWidth = 3 * f;
        ctx.beginPath(); ctx.arc(q.x, q.y, 12 * f, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5 * f, 0, 7); ctx.fill();
      }
      ctx.restore();
    } else if (S.sel >= 0 && S.cuadros[S.sel]) {
      const s = S.cuadros[S.sel], x0 = S.gx - S.bw / 2 + s.x, y0 = S.gy - S.bh / 2 + s.y;
      const c = [[x0, y0], [x0 + s.w, y0], [x0 + s.w, y0 + s.h], [x0, y0 + s.h]].map((p) => proyectar(H, p[0], p[1]));
      ctx.save(); ctx.lineWidth = 3 * f; ctx.setLineDash([8 * f, 6 * f]); ctx.strokeStyle = "#fff"; ctx.beginPath();
      c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
      ctx.lineDashOffset = 7 * f; ctx.strokeStyle = ac; ctx.stroke(); ctx.restore();
    }
  }
  function medidas() {
    const grupos = new Map<string, number>();
    for (const s of S.cuadros) { const k = `${fmt(s.w)} × ${fmt(s.h)} cm`; grupos.set(k, (grupos.get(k) ?? 0) + 1); }
    const partes = [...grupos].map(([k, n]) => `${n} de ${k}`).join(" y ");
    const n = S.cuadros.length;
    let html = `<span>Conjunto: <b>${fmt(S.bw)} × ${fmt(S.bh)} cm</b></span><span>${n === 1 ? "1 cuadro" : `${n} cuadros`}: ${partes}</span>`;
    if (S.piso) {
      html += `<span>Centro a <b>${fmt(S.refH - S.gy)} cm</b> del piso</span><span>Borde de abajo a <b>${fmt(S.refH - (S.gy + S.bh / 2))} cm</b> del piso</span>`;
    }
    $("medidas").innerHTML = html;
  }

  /* ---- Arrastre sobre la foto ---- */
  const punto = (e: PointerEvent): Punto => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
  };
  function cuadroEn(w: Punto) {
    const lx = w.x - (S.gx - S.bw / 2), ly = w.y - (S.gy - S.bh / 2);
    return S.cuadros.findIndex((s) => lx >= s.x && lx <= s.x + s.w && ly >= s.y && ly <= s.y + s.h);
  }
  function alApoyar(e: PointerEvent) {
    if (!S.Hi) return;
    const p = punto(e), f = escala();
    if (S.modo === "pared") {
      let mejor = -1, md = 30 * f;
      S.quad.forEach((q, i) => { const d = dist(q, p); if (d < md) { md = d; mejor = i; } });
      if (mejor >= 0) arrastre = { tipo: "esquina", i: mejor };
    } else {
      const w = aLaPared(S.Hi, p); if (!w) return;
      S.sel = cuadroEn(w); arrastre = { tipo: "conjunto", desde: w, g0: { x: S.gx, y: S.gy } };
      miniaturas();
    }
    if (arrastre) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    pedir(false);
  }
  function alMover(e: PointerEvent) {
    if (!arrastre) return;
    const p = punto(e);
    if (arrastre.tipo === "esquina") {
      S.quad[arrastre.i] = { x: clamp(p.x, 0, cv.width), y: clamp(p.y, 0, cv.height) }; recalcularH(); pedir(false);
    } else if (S.Hi) {
      const w = aLaPared(S.Hi, p); if (!w) return;
      S.gx = clamp(arrastre.g0.x + (w.x - arrastre.desde.x), -S.refW, S.refW * 2);
      S.gy = clamp(arrastre.g0.y + (w.y - arrastre.desde.y), -S.refH, S.refH * 2);
      pedir(false);
    }
  }
  function alSoltar() {
    if (!arrastre) return;
    const eraEsquina = arrastre.tipo === "esquina"; arrastre = null; pedir(eraEsquina);
  }
  function alTeclear(e: KeyboardEvent) {
    const paso = e.shiftKey ? 10 : 1;
    const m = ({ ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] } as Record<string, number[]>)[e.key];
    if (m) { e.preventDefault(); S.gx += m[0]; S.gy += m[1]; pedir(false); }
  }
  const alRedimensionar = () => pedir(false);
  cv.addEventListener("pointerdown", alApoyar); cv.addEventListener("pointermove", alMover);
  cv.addEventListener("pointerup", alSoltar); cv.addEventListener("pointercancel", alSoltar);
  cv.addEventListener("keydown", alTeclear); window.addEventListener("resize", alRedimensionar);

  /* ---- Panel ---- */
  function fijarModo(m: "pared" | "ubicar") {
    S.modo = m;
    $("modo-pared").setAttribute("aria-pressed", String(m === "pared"));
    $("modo-ubicar").setAttribute("aria-pressed", String(m === "ubicar"));
    cv.classList.toggle("pdc-modo-pared", m === "pared");
    $("pista").textContent = m === "pared"
      ? "Arrastrá los 4 puntos a las esquinas de lo que vas a usar de medida y cargá su ancho y alto en el panel."
      : "Arrastrá para mover los cuadros. Tocá uno para cambiarle la foto. Con las flechas del teclado lo movés de a 1 cm.";
    pedir(false);
  }
  $("modo-pared").onclick = () => fijarModo("pared");
  $("modo-ubicar").onclick = () => fijarModo("ubicar");

  function icono(id: ComposicionId) {
    const sl = cuadrosDe(id, 2, 3, 0.45), { w: bw, h: bh } = medidaDelConjunto(sl);
    const sc = Math.min(40 / bw, 26 / bh), ox = (44 - bw * sc) / 2, oy = (30 - bh * sc) / 2;
    return `<svg viewBox="0 0 44 30" aria-hidden="true">${sl.map((s) => `<rect x="${(ox + s.x * sc).toFixed(2)}" y="${(oy + s.y * sc).toFixed(2)}" width="${(s.w * sc).toFixed(2)}" height="${(s.h * sc).toFixed(2)}" rx=".6"/>`).join("")}</svg>`;
  }
  function composiciones() {
    const cont = $("composiciones");
    cont.innerHTML = COMPOSICIONES.map(({ id, label }) => `<button type="button" class="pdc-chip" data-id="${id}" aria-pressed="${S.composicion === id}">${icono(id)}${label}</button>`).join("");
    cont.querySelectorAll<HTMLButtonElement>(".pdc-chip").forEach((b) => (b.onclick = () => {
      S.composicion = b.dataset.id as ComposicionId; S.sel = -1; composiciones(); pedir(true);
    }));
  }
  function marcos() {
    const muestra = (f: Marco) => {
      if (f.lienzo) return "background:linear-gradient(135deg,#e3ad66,#c76b5b 55%,#4a3b52)";
      const b = f.base!;
      if (f.metal) return `background:linear-gradient(135deg,${rgb(b, 1.3)},${rgb(b, 0.85)} 50%,${rgb(b, 1.15)})`;
      return `background:${rgb(b, 1)}${f.vetas ? ";background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.12) 0 1px,transparent 1px 4px)" : ""}`;
    };
    const cont = $("marcos");
    cont.innerHTML = Object.entries(MARCOS).map(([id, f]) => `<button type="button" class="pdc-sw" data-id="${id}" aria-pressed="${S.marco === id}"><i style="${muestra(f)}"></i>${f.label}</button>`).join("");
    cont.querySelectorAll<HTMLButtonElement>(".pdc-sw").forEach((b) => (b.onclick = () => {
      S.marco = b.dataset.id!; $<HTMLSelectElement>("paspartu").disabled = !!MARCOS[S.marco].lienzo; marcos(); pedir(true);
    }));
  }
  function miniaturas() {
    const sel = S.repartida ? indiceDeFoto(0) : S.sel >= 0 ? indiceDeFoto(S.sel) : -1;
    const cont = $("miniaturas");
    cont.innerHTML = S.fotos.map((p, i) => `<button type="button" class="pdc-thumb" data-i="${i}" aria-pressed="${i === sel}" aria-label="Foto ${i + 1}"><img src="${p.thumb}" alt=""></button>`).join("");
    cont.querySelectorAll<HTMLButtonElement>(".pdc-thumb").forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.i);
      if (S.repartida) S.fotoDe[0] = i;
      else if (S.sel >= 0) S.fotoDe[S.sel] = i;
      else { $("nota-fotos").textContent = "Primero tocá un cuadro en la pared para elegir dónde va esta foto."; return; }
      miniaturas(); pedir(true);
    }));
    $("etiqueta-muestras").hidden = !S.deMuestra;
  }

  const medida = $<HTMLSelectElement>("medida");
  medida.innerHTML = MEDIDAS.map((s, i) => `<option value="${i}">${s[0]} × ${s[1]} cm</option>`).join("");
  const enlazar = (n: string, alCambiar: (el: HTMLInputElement) => void, capa = true) => {
    const el = $<HTMLInputElement>(n);
    const h = () => { alCambiar(el); pedir(capa); };
    el.addEventListener("input", h);
    return () => el.removeEventListener("input", h);
  };
  const desenlazar = [
    enlazar("medida", (el) => (S.medida = Number(el.value))),
    enlazar("orientacion", (el) => (S.orient = el.value)),
    enlazar("separacion", (el) => { S.sep = Number(el.value); $("separacion-valor").textContent = `${S.sep} cm`; }),
    enlazar("paspartu", (el) => (S.paspartu = Number(el.value))),
    enlazar("repartida", (el) => { S.repartida = el.checked; miniaturas(); }),
    enlazar("piso", (el) => (S.piso = el.checked), false),
    enlazar("ref-ancho", (el) => { S.refW = clamp(Number(el.value) || 100, 10, 2000); recalcularH(); }),
    enlazar("ref-alto", (el) => { S.refH = clamp(Number(el.value) || 100, 10, 2000); recalcularH(); }),
  ];
  $("rotar").onclick = () => { S.fotoDe = []; S.giro = (S.giro + 1) % Math.max(1, S.fotos.length); miniaturas(); pedir(true); };
  $("centrar").onclick = () => { S.gx = S.refW / 2; pedir(false); };
  $("altura-galeria").onclick = () => {
    if (!S.piso) { S.piso = true; $<HTMLInputElement>("piso").checked = true; }
    S.gy = S.refH - 150; pedir(false);
  };

  function sincronizar() {
    medida.value = String(S.medida);
    $<HTMLSelectElement>("orientacion").value = S.orient;
    $<HTMLInputElement>("separacion").value = String(S.sep);
    $("separacion-valor").textContent = `${S.sep} cm`;
    $<HTMLSelectElement>("paspartu").value = String(S.paspartu);
    $<HTMLSelectElement>("paspartu").disabled = !!MARCOS[S.marco].lienzo;
    $<HTMLInputElement>("repartida").checked = S.repartida;
    $<HTMLInputElement>("ref-ancho").value = String(S.refW);
    $<HTMLInputElement>("ref-alto").value = String(S.refH);
    $<HTMLInputElement>("piso").checked = S.piso;
  }
  function usarLiving() {
    const s = livingDeEjemplo();
    S.pared = s.canvas; S.quad = s.quad.map((q) => ({ ...q })); S.refW = s.RW; S.refH = s.RH; S.piso = true;
    S.gx = 185; S.gy = S.refH - 145; recalcularH(); sincronizar(); fijarModo("ubicar"); pedir(true);
  }
  $("living").onclick = usarLiving;

  const mostrarError = (n: string, texto: string | null) => { const el = $(n); el.textContent = texto ?? ""; el.hidden = !texto; };
  $<HTMLInputElement>("archivo-pared").onchange = async (e) => {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0]; input.value = "";
    if (!f) return;
    mostrarError("error-pared", null);
    try {
      const c = await leerArchivo(f, 2000);
      S.pared = c;
      const W = c.width, H = c.height;
      S.quad = [{ x: W * 0.2, y: H * 0.18 }, { x: W * 0.8, y: H * 0.18 }, { x: W * 0.8, y: H * 0.72 }, { x: W * 0.2, y: H * 0.72 }];
      S.refW = 200; S.refH = 150; S.piso = false; S.gx = 100; S.gy = 75;
      recalcularH(); sincronizar(); fijarModo("pared"); pedir(true);
    } catch {
      mostrarError("error-pared", "No pude abrir esa imagen. Probá con una foto en JPG o PNG.");
    }
  };
  $<HTMLInputElement>("archivo-fotos").onchange = async (e) => {
    const input = e.currentTarget as HTMLInputElement, archivos = [...(input.files ?? [])]; input.value = "";
    if (!archivos.length) return;
    mostrarError("error-fotos", null);
    const nuevas: Foto[] = [];
    let malas = 0;
    for (const f of archivos) {
      try { const c = await leerArchivo(f, 1600); nuevas.push({ img: c, thumb: miniatura(c) }); } catch { malas++; }
    }
    if (nuevas.length) {
      if (S.deMuestra) { S.fotos = []; S.fotoDe = []; S.giro = 0; S.deMuestra = false; }
      const desde = S.fotos.length; S.fotos.push(...nuevas);
      if (S.sel >= 0 && nuevas.length === 1 && !S.repartida) S.fotoDe[S.sel] = desde;
      $("nota-fotos").textContent = "Tocá un cuadro en la pared y después una foto para ponerla ahí.";
      miniaturas(); pedir(true);
    }
    if (malas) mostrarError("error-fotos", `${malas === 1 ? "Una foto no se pudo abrir" : `${malas} fotos no se pudieron abrir`}. Probá con JPG o PNG.`);
  };

  const modal = $("modal");
  const cerrarModal = () => { modal.hidden = true; };
  $("ver-final").onclick = () => {
    if (rearmar) { armarCapa(); rearmar = false; }
    dibujar(true); $<HTMLImageElement>("imagen-final").src = cv.toDataURL("image/jpeg", 0.92); dibujar(false);
    modal.hidden = false; $("cerrar-modal").focus();
  };
  $("cerrar-modal").onclick = cerrarModal;
  modal.onclick = (e) => { if (e.target === modal) cerrarModal(); };
  const alEscape = (e: KeyboardEvent) => { if (e.key === "Escape") cerrarModal(); };
  document.addEventListener("keydown", alEscape);

  /* ---- Arranque ---- */
  S.fotos = PALETAS.map((_, i) => { const c = fotoDeMuestra(i); return { img: c, thumb: miniatura(c) }; });
  composiciones(); marcos(); miniaturas(); usarLiving();

  return () => {
    cancelAnimationFrame(raf);
    cv.removeEventListener("pointerdown", alApoyar); cv.removeEventListener("pointermove", alMover);
    cv.removeEventListener("pointerup", alSoltar); cv.removeEventListener("pointercancel", alSoltar);
    cv.removeEventListener("keydown", alTeclear); window.removeEventListener("resize", alRedimensionar);
    document.removeEventListener("keydown", alEscape);
    desenlazar.forEach((d) => d());
    gl?.gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
