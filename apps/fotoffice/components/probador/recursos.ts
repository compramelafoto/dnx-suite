import { esquinasDeReferencia, homografia, proyectar, type Punto } from "@/lib/probador/geometria";

/**
 * Lo que el probador necesita y no cambia con la composición: el living de ejemplo, las fotos de
 * muestra, la lectura de las fotos del cliente y la proyección con WebGL. Sólo corre en el
 * navegador.
 */

/** Azar con semilla: el living y las fotos de muestra salen siempre iguales. */
export function azar(semilla: number) {
  return () => {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lienzo(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}

/* ---------- Living de ejemplo ---------- */
export function livingDeEjemplo() {
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
export const PALETAS: Paleta[] = [
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
export function fotoDeMuestra(i: number) {
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
export function miniatura(c: HTMLCanvasElement) {
  const s = 160 / Math.max(c.width, c.height), t = lienzo(Math.round(c.width * s), Math.round(c.height * s));
  t.g.drawImage(c, 0, 0, t.c.width, t.c.height);
  return t.c.toDataURL("image/jpeg", 0.8);
}

/** Lee una imagen elegida por el cliente y la achica a `max` px de lado. Nada se sube. */
export function leerArchivo(file: File, max: number): Promise<HTMLCanvasElement> {
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
export type Gl = { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; tex: WebGLTexture; u: Record<string, WebGLUniformLocation | null> };
export function iniciarGl(): Gl | null {
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
