import {
  aLaPared,
  COMPOSICIONES,
  esquinasDeReferencia,
  homografia,
  invertir,
  MEDIDAS,
  proyectar,
  type ComposicionId,
  type Homografia,
  type Punto,
  type Rect,
} from "@/lib/probador/geometria";
import {
  dimensionesRotadas,
  desplazar,
  ENCUADRE_INICIAL,
  escalaMinima,
  ESCALA_MAXIMA,
  INCLINACION_MAXIMA,
  normalizarEncuadre,
  transformacion,
  type Encuadre,
  type Giro90,
} from "@/lib/probador/encuadre";
import {
  aplicarATodos,
  cambiarCuadro,
  cambiarMedida,
  centroEnLaPared,
  desdePlantilla,
  duplicarCuadro,
  moverConjunto,
  moverCuadro,
  PASPARTUS,
  PERFIL_MARCO_CM,
  quitarCuadro,
  rectanguloDelConjunto,
  rectFoto,
  type Composicion,
  type Cuadro,
  type TipoCuadro,
} from "@/lib/probador/composicion";
import { deshacer, iniciar, puedeDeshacer, puedeRehacer, registrar, rehacer, type Historial } from "@/lib/probador/historial";
import { fotoDeMuestra, iniciarGl, leerArchivo, lienzo, livingDeEjemplo, miniatura, PALETAS } from "./recursos";

/**
 * El motor del probador: dibuja la foto de la pared con los cuadros encima y atiende los gestos.
 * Es imperativo a propósito — todo pasa en un `<canvas>` que se redibuja en cada movimiento del
 * dedo, y pasar eso por el estado de React haría re-renderizar el panel entero 60 veces por segundo.
 *
 * La composición es un dato puro (`lib/probador/composicion.ts`) guardado en un historial: cada
 * gesto terminado registra un estado nuevo, y ⌘Z vuelve al anterior. Mientras el dedo se mueve se
 * dibuja un estado provisorio (`provisorio`) que no entra al historial.
 *
 * Los cuadros se arman "de frente" en una capa en cm (`armarCapa`) y esa capa se proyecta sobre la
 * foto con la homografía de la pared: WebGL si está, triángulos si no.
 *
 * Nada sale del navegador: las fotos del cliente se leen con `URL.createObjectURL` y no se suben.
 */

type Foto = { img: HTMLCanvasElement; thumb: string };
type Capa = { canvas: HTMLCanvasElement; k: number; m: number; rx: number; ry: number; firma: unknown[] };
type Arrastre =
  | { tipo: "esquina"; i: number }
  | { tipo: "conjunto"; desde: Punto; comp0: Composicion; sobre: string | null; movio: boolean; px0: Punto }
  | { tipo: "cuadro"; id: string; desde: Punto; comp0: Composicion; movio: boolean; px0: Punto }
  | { tipo: "foto"; desde: Punto; comp0: Composicion };

const MARCO_GENERICO: readonly [number, number, number] = [30, 30, 32];
const TIPOS: { id: TipoCuadro; label: string }[] = [
  { id: "IMPRESION", label: "Impresión" },
  { id: "CANVAS", label: "Canvas" },
  { id: "MARCO", label: "Con marco" },
];
/** Cuánto hay que mover el dedo (px de pantalla) para que deje de ser un toque. */
const UMBRAL_TOQUE = 5;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
const rgb = (c: readonly number[], s: number) =>
  `rgb(${clamp(c[0] * s, 0, 255) | 0},${clamp(c[1] * s, 0, 255) | 0},${clamp(c[2] * s, 0, 255) | 0})`;
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-AR");
const esCampo = (el: Element | null) => !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

/** Monta el probador sobre el marcado de `ProbadorCuadros` (los `data-pdc`). Devuelve cómo desmontarlo. */
export function montarProbador(raiz: HTMLElement): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(n: string) => raiz.querySelector<T>(`[data-pdc="${n}"]`)!;
  const cv = $<HTMLCanvasElement>("lienzo"), ctx = cv.getContext("2d")!;
  const gl = iniciarGl();

  const P = {
    pared: null as HTMLCanvasElement | null, quad: [] as Punto[], refW: 380, refH: 260, piso: true,
    H: null as Homografia | null, Hi: null as Homografia | null, modoPared: false,
    fotos: [] as Foto[], deMuestra: true,
    // Lo que el panel "Conjunto" usa para rearmar la plantilla.
    plantilla: "escalonado5" as ComposicionId, medida: 3, orient: "v", sep: 5,
    hist: null as unknown as Historial<Composicion>, provisorio: null as Composicion | null,
    sel: null as string | null, encuadrando: false, guias: { x: [] as number[], y: [] as number[] },
    capa: null as Capa | null,
  };
  const comp = () => P.provisorio ?? P.hist.actual;
  const cuadroSel = () => comp().cuadros.find((q) => q.id === P.sel) ?? null;
  const fotoDe = (i: number) => P.fotos.length ? P.fotos[((i % P.fotos.length) + P.fotos.length) % P.fotos.length].img : undefined;

  function confirmar(nueva: Composicion) {
    P.provisorio = null;
    P.hist = registrar(P.hist, nueva);
    if (P.sel && !nueva.cuadros.some((q) => q.id === P.sel)) { P.sel = null; P.encuadrando = false; }
    pedir(); panel();
  }
  function recalcularH() {
    const H = homografia(esquinasDeReferencia(P.refW, P.refH), P.quad);
    if (H) { P.H = H; P.Hi = invertir(H); }
  }

  /* ---------- Encuadres ---------- */
  /** El rectángulo sobre el que se encuadra la foto de un cuadro: el propio, o el del conjunto con "una foto". */
  function marcoDelEncuadre(c: Composicion, q: Cuadro): Rect {
    return c.unaFoto ? rectanguloDelConjunto(c) : rectFoto(q);
  }
  function encuadreDe(c: Composicion, q: Cuadro): Encuadre {
    const img = fotoDe(c.unaFoto ? c.fotoConjunto : q.foto);
    const r = marcoDelEncuadre(c, q), e = c.unaFoto ? c.encuadreConjunto : q.encuadre;
    return img ? normalizarEncuadre(e, r, { w: img.width, h: img.height }) : e;
  }
  /** Aplica un cambio al encuadre que corresponda (el del cuadro o el del conjunto). */
  function conEncuadre(c: Composicion, q: Cuadro, f: (e: Encuadre, r: Rect, foto: { w: number; h: number }) => Encuadre): Composicion {
    const img = fotoDe(c.unaFoto ? c.fotoConjunto : q.foto);
    if (!img) return c;
    const r = marcoDelEncuadre(c, q), foto = { w: img.width, h: img.height };
    const nuevo = normalizarEncuadre(f(encuadreDe(c, q), r, foto), r, foto);
    return c.unaFoto ? { ...c, encuadreConjunto: nuevo } : cambiarCuadro(c, q.id, { encuadre: nuevo });
  }

  /* ---------- Capa de cuadros, de frente y en cm ---------- */
  function fotoEncuadrada(g: CanvasRenderingContext2D, img: HTMLCanvasElement, ventana: Rect, r: Rect, e: Encuadre, alpha = 1) {
    const t = transformacion(e, r, { w: img.width, h: img.height });
    const f = dimensionesRotadas({ w: img.width, h: img.height }, e.rot90);
    g.save();
    if (alpha === 1) { g.beginPath(); g.rect(ventana.x, ventana.y, ventana.w, ventana.h); g.clip(); }
    g.globalAlpha = alpha;
    g.translate(r.x + r.w / 2, r.y + r.h / 2); g.rotate(t.theta); g.scale(t.s, t.s); g.translate(-t.fx, -t.fy);
    g.translate(f.w / 2, f.h / 2); g.rotate((e.rot90 * Math.PI) / 180);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    g.restore();
  }
  function dibujarCuadro(g: CanvasRenderingContext2D, c: Composicion, q: Cuadro, k: number) {
    const { x, y, w, h } = q;
    const lienzoT = q.tipo === "CANVAS";
    g.save(); g.shadowColor = "rgba(25,18,10,.34)"; g.shadowBlur = (lienzoT ? 2.2 : q.tipo === "IMPRESION" ? 1 : 1.6) * k;
    g.shadowOffsetX = 0.5 * k; g.shadowOffsetY = (lienzoT ? 1.8 : q.tipo === "IMPRESION" ? 0.6 : 1.3) * k; g.fillStyle = "#222"; g.fillRect(x, y, w, h); g.restore();
    g.save(); g.shadowColor = "rgba(25,18,10,.35)"; g.shadowBlur = 0.35 * k; g.shadowOffsetY = 0.18 * k; g.fillStyle = "#222"; g.fillRect(x, y, w, h); g.restore();
    const ventana = rectFoto(q), img = fotoDe(c.unaFoto ? c.fotoConjunto : q.foto);
    if (q.tipo === "MARCO" && q.paspartu > 0) {
      g.fillStyle = "#f6f4ef"; g.fillRect(x + PERFIL_MARCO_CM, y + PERFIL_MARCO_CM, w - 2 * PERFIL_MARCO_CM, h - 2 * PERFIL_MARCO_CM);
    }
    if (img) fotoEncuadrada(g, img, ventana, marcoDelEncuadre(c, q), encuadreDe(c, q));
    else { g.fillStyle = "#c9cdca"; g.fillRect(ventana.x, ventana.y, ventana.w, ventana.h); }
    if (lienzoT) {
      const e = Math.min(w, h) * 0.04;
      let gr = g.createLinearGradient(x + w - e, 0, x + w, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.22)");
      g.fillStyle = gr; g.fillRect(x + w - e, y, e, h);
      gr = g.createLinearGradient(0, y + h - e, 0, y + h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.25)");
      g.fillStyle = gr; g.fillRect(x, y + h - e, w, e);
      return;
    }
    if (q.tipo === "IMPRESION") {
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 0.15; g.strokeRect(x + 0.075, y + 0.075, w - 0.15, h - 0.15);
      return;
    }
    // Con marco: paspartú con bisel, sombra del marco sobre el contenido, vidrio y los cuatro lados.
    const fw = PERFIL_MARCO_CM, inner = { x: x + fw, y: y + fw, w: w - 2 * fw, h: h - 2 * fw };
    if (q.paspartu > 0) {
      const b = 0.35, f = ventana;
      g.fillStyle = "#e4ded2"; g.fillRect(f.x - b, f.y - b, f.w + 2 * b, b); g.fillRect(f.x - b, f.y, b, f.h);
      g.fillStyle = "#fffdf8"; g.fillRect(f.x, f.y + f.h, f.w + b, b); g.fillRect(f.x + f.w, f.y - b, b, f.h + b);
    }
    let gr = g.createLinearGradient(0, inner.y, 0, inner.y + 1.2); gr.addColorStop(0, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(inner.x, inner.y, inner.w, 1.2);
    gr = g.createLinearGradient(inner.x, 0, inner.x + 0.9, 0); gr.addColorStop(0, "rgba(0,0,0,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(inner.x, inner.y, 0.9, inner.h);
    g.save(); g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
    gr = g.createLinearGradient(inner.x, inner.y, inner.x + inner.w * 0.6, inner.y + inner.h * 0.6);
    gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(0.45, "rgba(255,255,255,.03)"); gr.addColorStop(0.46, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(inner.x, inner.y, inner.w, inner.h); g.restore();
    const o = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as const;
    const n = [[inner.x, inner.y], [inner.x + inner.w, inner.y], [inner.x + inner.w, inner.y + inner.h], [inner.x, inner.y + inner.h]] as const;
    for (const [a, b, sh] of [[0, 1, 1.14], [1, 2, 0.84], [2, 3, 0.72], [3, 0, 1.03]] as const) {
      g.beginPath(); g.moveTo(o[a][0], o[a][1]); g.lineTo(o[b][0], o[b][1]); g.lineTo(n[b][0], n[b][1]); g.lineTo(n[a][0], n[a][1]); g.closePath();
      g.fillStyle = rgb(MARCO_GENERICO, sh); g.fill();
    }
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 0.12; g.strokeRect(x + 0.06, y + 0.06, w - 0.12, h - 0.12);
  }
  function armarCapa(c: Composicion) {
    const q = P.quad, r = rectanguloDelConjunto(c), m = 8;
    const ppc = Math.max(dist(q[0], q[1]) / P.refW, dist(q[3], q[2]) / P.refW, dist(q[0], q[3]) / P.refH, dist(q[1], q[2]) / P.refH);
    const k = Math.min(clamp(ppc * 1.15, 1.5, 14), 4096 / (r.w + 2 * m), 4096 / (r.h + 2 * m));
    const { c: canvas, g } = lienzo(Math.ceil((r.w + 2 * m) * k), Math.ceil((r.h + 2 * m) * k));
    g.scale(k, k); g.translate(m - r.x, m - r.y);
    const sel = P.encuadrando ? c.cuadros.find((x) => x.id === P.sel) : null;
    // En modo encuadre se ve, tenue, la foto entera: así se entiende qué parte queda afuera.
    if (sel) {
      const img = fotoDe(c.unaFoto ? c.fotoConjunto : sel.foto);
      if (img) fotoEncuadrada(g, img, rectFoto(sel), marcoDelEncuadre(c, sel), encuadreDe(c, sel), 0.3);
    }
    for (const x of c.cuadros) dibujarCuadro(g, c, x, k);
    P.capa = { canvas, k, m, rx: r.x, ry: r.y, firma: firmaDe(c) };
    if (gl) {
      gl.gl.bindTexture(gl.gl.TEXTURE_2D, gl.tex);
      gl.gl.pixelStorei(gl.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.gl.texImage2D(gl.gl.TEXTURE_2D, 0, gl.gl.RGBA, gl.gl.RGBA, gl.gl.UNSIGNED_BYTE, canvas);
    }
  }
  /** Lo que obliga a redibujar la capa: todo menos mover el conjunto entero sobre la pared. */
  const firmaDe = (c: Composicion) => [c.cuadros, c.unaFoto, c.fotoConjunto, c.encuadreConjunto, P.fotos, P.encuadrando, P.sel, P.quad, P.refW, P.refH];
  const capaVigente = (c: Composicion) => !!P.capa && firmaDe(c).every((v, i) => v === P.capa!.firma[i]);

  /* ---------- Proyección de la capa sobre la foto ---------- */
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
  function proyectarCapa(c: Composicion, alpha: number) {
    const L = P.capa; if (!L || !P.H || !P.Hi) return;
    const ox = c.ox + L.rx - L.m, oy = c.oy + L.ry - L.m;
    if (gl) {
      const g = gl.gl;
      if (gl.canvas.width !== cv.width || gl.canvas.height !== cv.height) { gl.canvas.width = cv.width; gl.canvas.height = cv.height; }
      g.viewport(0, 0, gl.canvas.width, gl.canvas.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      const h = P.Hi;
      g.uniformMatrix3fv(gl.u.Hi, false, new Float32Array([h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]));
      g.uniform2f(gl.u.origin, ox, oy); g.uniform1f(gl.u.k, L.k); g.uniform2f(gl.u.size, L.canvas.width, L.canvas.height);
      g.uniform1f(gl.u.viewH, gl.canvas.height); g.uniform1f(gl.u.alpha, alpha); g.uniform1i(gl.u.tex, 0);
      g.drawArrays(g.TRIANGLES, 0, 6);
      ctx.drawImage(gl.canvas, 0, 0);
      return;
    }
    const N = arrastre ? 10 : 22, Wd = L.canvas.width, Hd = L.canvas.height, pts: (Vertice & { ok: boolean })[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = (i / N) * Wd, v = (j / N) * Hd, p = proyectar(P.H, ox + u / L.k, oy + v / L.k);
      pts.push({ u, v, x: p.x, y: p.y, ok: p.w > 0 });
    }
    ctx.globalAlpha = alpha;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = pts[j * (N + 1) + i], b = pts[j * (N + 1) + i + 1], d2 = pts[(j + 1) * (N + 1) + i + 1], e2 = pts[(j + 1) * (N + 1) + i];
      if (!(a.ok && b.ok && d2.ok && e2.ok)) continue;
      triangulo(L.canvas, a, b, d2); triangulo(L.canvas, a, d2, e2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Dibujo en pantalla ---------- */
  let raf = 0;
  let arrastre: Arrastre | null = null;
  const punteros = new Map<number, Punto>();
  let pellizco: { d0: number; a0: number; comp0: Composicion; e0: Encuadre } | null = null;
  const escala = () => { const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; };
  const acento = () => getComputedStyle(raiz).getPropertyValue("--pdc-accent").trim() || "#2b6a5f";
  function pedir() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; dibujar(false); }); }
  function dibujar(limpio: boolean) {
    if (!P.pared || !P.H) return;
    if (cv.width !== P.pared.width || cv.height !== P.pared.height) { cv.width = P.pared.width; cv.height = P.pared.height; }
    const c = comp();
    if (!capaVigente(c)) armarCapa(c);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(P.pared, 0, 0);
    proyectarCapa(c, !limpio && P.modoPared ? 0.55 : 1);
    if (!limpio) guias(c);
    medidas(c);
  }
  function linea(a: Punto, b: Punto) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function poligono(pts: Punto[]) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
  function guias(c: Composicion) {
    const H = P.H!, f = escala(), ac = acento();
    const enPared = (x: number, y: number) => proyectar(H, c.ox + x, c.oy + y);
    if (P.modoPared) {
      ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = f;
      for (let x = 50; x < P.refW; x += 50) linea(proyectar(H, x, 0), proyectar(H, x, P.refH));
      for (let y = 50; y < P.refH; y += 50) linea(proyectar(H, 0, y), proyectar(H, P.refW, y));
      ctx.strokeStyle = ac; ctx.lineWidth = 2.5 * f; poligono(P.quad); ctx.stroke();
      ctx.font = `600 ${13 * f}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const etiqueta = (p: Punto, t: string) => {
        const w = ctx.measureText(t).width + 12 * f;
        ctx.fillStyle = ac; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 11 * f, w, 22 * f, 6 * f); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(t, p.x, p.y + 0.5 * f);
      };
      const arriba = proyectar(H, P.refW / 2, 0), izq = proyectar(H, 0, P.refH / 2);
      etiqueta({ x: arriba.x, y: arriba.y - 20 * f }, `${P.refW} cm`);
      etiqueta({ x: izq.x + 34 * f, y: izq.y }, `${P.refH} cm`);
      for (const q of P.quad) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = ac; ctx.lineWidth = 3 * f;
        ctx.beginPath(); ctx.arc(q.x, q.y, 12 * f, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5 * f, 0, 7); ctx.fill();
      }
      ctx.restore();
      return;
    }
    const q = c.cuadros.find((x) => x.id === P.sel);
    if (!q) return;
    ctx.save(); ctx.lineWidth = 3 * f; ctx.setLineDash([8 * f, 6 * f]);
    poligono([enPared(q.x, q.y), enPared(q.x + q.w, q.y), enPared(q.x + q.w, q.y + q.h), enPared(q.x, q.y + q.h)]);
    ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.lineDashOffset = 7 * f; ctx.strokeStyle = ac; ctx.stroke();
    ctx.setLineDash([]);
    const r = rectanguloDelConjunto(c);
    ctx.strokeStyle = ac; ctx.lineWidth = 1.5 * f;
    for (const x of P.guias.x) linea(enPared(x, r.y - 8), enPared(x, r.y + r.h + 8));
    for (const y of P.guias.y) linea(enPared(r.x - 8, y), enPared(r.x + r.w + 8, y));
    ctx.restore();
  }
  function medidas(c: Composicion) {
    const r = rectanguloDelConjunto(c), grupos = new Map<string, number>();
    const nombre: Record<TipoCuadro, [string, string]> = { IMPRESION: ["impresión", "impresiones"], CANVAS: ["canvas", "canvas"], MARCO: ["con marco", "con marco"] };
    for (const q of c.cuadros) { const k = `${q.tipo}|${fmt(q.w)} × ${fmt(q.h)} cm`; grupos.set(k, (grupos.get(k) ?? 0) + 1); }
    const partes = [...grupos].map(([k, n]) => {
      const [tipo, medida] = k.split("|") as [TipoCuadro, string];
      return `${n} ${nombre[tipo][n === 1 ? 0 : 1]} de ${medida}`;
    }).join(" · ");
    let html = `<span>Conjunto: <b>${fmt(r.w)} × ${fmt(r.h)} cm</b></span><span>${partes}</span>`;
    if (P.piso) {
      const centro = centroEnLaPared(c);
      html += `<span>Centro a <b>${fmt(P.refH - centro.y)} cm</b> del piso</span><span>Borde de abajo a <b>${fmt(P.refH - (c.oy + r.y + r.h))} cm</b> del piso</span>`;
    }
    $("medidas").innerHTML = html;
  }

  /* ---------- Gestos sobre la foto ---------- */
  const punto = (e: PointerEvent): Punto => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
  };
  const enLaPared = (p: Punto) => (P.Hi ? aLaPared(P.Hi, p) : null);
  function cuadroEn(c: Composicion, w: Punto) {
    const lx = w.x - c.ox, ly = w.y - c.oy;
    for (let i = c.cuadros.length - 1; i >= 0; i--) {
      const q = c.cuadros[i];
      if (lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h) return q.id;
    }
    return null;
  }
  function seleccionar(id: string | null) {
    P.sel = id; if (!id) P.encuadrando = false; P.guias = { x: [], y: [] };
    pedir(); panel();
  }
  function alApoyar(e: PointerEvent) {
    if (!P.Hi) return;
    const p = punto(e), f = escala();
    punteros.set(e.pointerId, p);
    cv.setPointerCapture(e.pointerId); e.preventDefault();
    if (P.modoPared) {
      let mejor = -1, md = 30 * f;
      P.quad.forEach((q, i) => { const d = dist(q, p); if (d < md) { md = d; mejor = i; } });
      if (mejor >= 0) arrastre = { tipo: "esquina", i: mejor };
      return;
    }
    const c = P.hist.actual;
    const q = cuadroSel();
    if (P.encuadrando && q && punteros.size === 2) {
      const [a, b] = [...punteros.values()].map((v) => enLaPared(v));
      if (a && b) pellizco = { d0: dist(a, b), a0: Math.atan2(b.y - a.y, b.x - a.x), comp0: comp(), e0: encuadreDe(comp(), q) };
      arrastre = null;
      return;
    }
    const w = enLaPared(p); if (!w) return;
    if (P.encuadrando && q) { arrastre = { tipo: "foto", desde: w, comp0: c }; return; }
    const sobre = cuadroEn(c, w);
    arrastre = sobre && sobre === P.sel
      ? { tipo: "cuadro", id: sobre, desde: w, comp0: c, movio: false, px0: p }
      : { tipo: "conjunto", desde: w, comp0: c, sobre, movio: false, px0: p };
  }
  function alMover(e: PointerEvent) {
    if (!punteros.has(e.pointerId)) return;
    const p = punto(e);
    punteros.set(e.pointerId, p);
    if (pellizco) {
      const q = cuadroSel(); if (!q) return;
      const [a, b] = [...punteros.values()].map((v) => enLaPared(v));
      if (!a || !b) return;
      const factor = dist(a, b) / (pellizco.d0 || 1), giro = ((Math.atan2(b.y - a.y, b.x - a.x) - pellizco.a0) * 180) / Math.PI;
      const e0 = pellizco.e0;
      P.provisorio = conEncuadre(pellizco.comp0, q, () => ({ ...e0, escala: e0.escala * factor, incl: e0.incl + giro }));
      pedir(); panel();
      return;
    }
    if (!arrastre) return;
    if (arrastre.tipo === "esquina") {
      P.quad = P.quad.map((v, i) => (i === (arrastre as { i: number }).i ? { x: clamp(p.x, 0, cv.width), y: clamp(p.y, 0, cv.height) } : v));
      recalcularH(); pedir();
      return;
    }
    const w = enLaPared(p); if (!w) return;
    const dx = w.x - arrastre.desde.x, dy = w.y - arrastre.desde.y;
    if (arrastre.tipo === "foto") {
      const q = arrastre.comp0.cuadros.find((x) => x.id === P.sel); if (!q) return;
      P.provisorio = conEncuadre(arrastre.comp0, q, (e0, r, foto) => desplazar(e0, dx, dy, r, foto));
    } else {
      if (!arrastre.movio && dist(p, arrastre.px0) / escala() < UMBRAL_TOQUE) return;
      arrastre.movio = true;
      if (arrastre.tipo === "conjunto") P.provisorio = moverConjunto(arrastre.comp0, dx, dy);
      else { const r = moverCuadro(arrastre.comp0, arrastre.id, dx, dy); P.provisorio = r.comp; P.guias = r.guias; }
    }
    pedir();
  }
  function alSoltar(e: PointerEvent) {
    punteros.delete(e.pointerId);
    if (pellizco) {
      if (punteros.size < 2) { pellizco = null; if (P.provisorio) confirmar(P.provisorio); }
      return;
    }
    const a = arrastre; arrastre = null;
    if (!a) return;
    if (a.tipo === "esquina") { pedir(); return; }
    P.guias = { x: [], y: [] };
    if ((a.tipo === "conjunto" || a.tipo === "cuadro") && !a.movio) {
      P.provisorio = null;
      // Un toque: sobre un cuadro lo selecciona; afuera, deselecciona.
      if (a.tipo === "conjunto") seleccionar(a.sobre);
      return;
    }
    if (P.provisorio) confirmar(P.provisorio); else pedir();
  }
  function alDobleToque(e: MouseEvent) {
    if (P.modoPared) return;
    const w = enLaPared(punto(e as PointerEvent)); if (!w) return;
    const id = cuadroEn(comp(), w);
    if (!id) return;
    P.sel = id; P.encuadrando = true; pedir(); panel();
  }
  let ruedaPendiente: ReturnType<typeof setTimeout> | null = null;
  function alGirarRueda(e: WheelEvent) {
    const q = cuadroSel();
    if (!P.encuadrando || !q) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    P.provisorio = conEncuadre(comp(), q, (e0) => ({ ...e0, escala: e0.escala * factor }));
    pedir(); panel();
    // La rueda llega en ráfagas: se registra un solo paso cuando el dedo para.
    if (ruedaPendiente) clearTimeout(ruedaPendiente);
    ruedaPendiente = setTimeout(() => { ruedaPendiente = null; if (P.provisorio) confirmar(P.provisorio); }, 350);
  }
  function alTeclear(e: KeyboardEvent) {
    if (esCampo(document.activeElement)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); P.hist = e.shiftKey ? rehacer(P.hist) : deshacer(P.hist); trasHistorial(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); P.hist = rehacer(P.hist); trasHistorial(); return; }
    if (e.key === "Escape") {
      if (!$("modal").hidden) { $("modal").hidden = true; return; }
      if (P.encuadrando) { P.encuadrando = false; pedir(); panel(); return; }
      if (P.sel) { seleccionar(null); return; }
      return;
    }
    // Lo que sigue sólo con el foco en la foto, para no robarle las flechas a la página.
    if (document.activeElement !== cv) return;
    const q = cuadroSel();
    if ((e.key === "Delete" || e.key === "Backspace") && q) { e.preventDefault(); confirmar(quitarCuadro(comp(), q.id)); return; }
    const paso = e.shiftKey ? 10 : 1;
    const m = ({ ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] } as Record<string, number[]>)[e.key];
    if (!m) return;
    e.preventDefault();
    confirmar(q ? moverCuadro(comp(), q.id, m[0], m[1], 0).comp : moverConjunto(comp(), m[0], m[1]));
  }
  function trasHistorial() {
    P.provisorio = null;
    if (P.sel && !P.hist.actual.cuadros.some((q) => q.id === P.sel)) { P.sel = null; P.encuadrando = false; }
    pedir(); panel();
  }
  const alRedimensionar = () => pedir();
  cv.addEventListener("pointerdown", alApoyar); cv.addEventListener("pointermove", alMover);
  cv.addEventListener("pointerup", alSoltar); cv.addEventListener("pointercancel", alSoltar);
  cv.addEventListener("dblclick", alDobleToque); cv.addEventListener("wheel", alGirarRueda, { passive: false });
  document.addEventListener("keydown", alTeclear); window.addEventListener("resize", alRedimensionar);

  /* ---------- Panel ---------- */
  const opcionesMedida = (w: number, h: number) => {
    const opciones = MEDIDAS.map(([a, b]) => `${a}x${b}`);
    const actual = `${fmt(Math.min(w, h))}x${fmt(Math.max(w, h))}`.replace(/,/g, ".");
    const html = MEDIDAS.map(([a, b]) => `<option value="${a}x${b}">${a} × ${b} cm</option>`).join("");
    return { html: opciones.includes(actual) ? html : `<option value="${actual}">${actual.replace("x", " × ")} cm (actual)</option>${html}`, actual };
  };
  const leerMedida = (v: string, vertical: boolean) => {
    const [a, b] = v.split("x").map(Number);
    return vertical ? { w: a, h: b } : { w: b, h: a };
  };
  const tiposHtml = (sel: TipoCuadro | null) =>
    TIPOS.map((t) => `<button type="button" data-tipo="${t.id}" aria-pressed="${t.id === sel}">${t.label}</button>`).join("");

  function panel() {
    const c = comp(), q = cuadroSel();
    $<HTMLButtonElement>("deshacer").disabled = !puedeDeshacer(P.hist);
    $<HTMLButtonElement>("rehacer").disabled = !puedeRehacer(P.hist);
    $("modo-pared").setAttribute("aria-pressed", String(P.modoPared));
    $("modo-ubicar").setAttribute("aria-pressed", String(!P.modoPared));
    cv.classList.toggle("pdc-modo-pared", P.modoPared);
    $("pista").textContent = P.modoPared
      ? "Arrastrá los 4 puntos a las esquinas de lo que vas a usar de medida y cargá su ancho y alto en el panel."
      : P.encuadrando
        ? "Arrastrá la foto para encuadrarla. Con la rueda o pellizcando cambiás el zoom; con dos dedos la inclinás."
        : q
          ? "Arrastrá el cuadro para moverlo. Tocalo dos veces para encuadrar la foto."
          : "Arrastrá para mover el conjunto. Tocá un cuadro para editarlo solo a él.";
    $("panel-conjunto").hidden = !!q;
    $("panel-cuadro").hidden = !q;
    $<HTMLInputElement>("una-foto").checked = c.unaFoto;
    $<HTMLInputElement>("una-foto").disabled = c.cuadros.length < 2;
    const tipos = new Set(c.cuadros.map((x) => x.tipo));
    $("tipo-todos").innerHTML = tiposHtml(tipos.size === 1 ? [...tipos][0] : null);
    const pasp = new Set(c.cuadros.filter((x) => x.tipo === "MARCO").map((x) => x.paspartu));
    $<HTMLSelectElement>("paspartu-todos").disabled = !tipos.has("MARCO");
    $<HTMLSelectElement>("paspartu-todos").value = pasp.size === 0 ? "0" : pasp.size === 1 ? String([...pasp][0]) : "";
    composiciones();
    miniaturas();
    if (!q) return;
    const n = c.cuadros.findIndex((x) => x.id === q.id) + 1;
    $("titulo-cuadro").textContent = `Cuadro ${n} de ${c.cuadros.length}`;
    $("tipo-cuadro").innerHTML = tiposHtml(q.tipo);
    const m = opcionesMedida(q.w, q.h);
    const medida = $<HTMLSelectElement>("medida-cuadro");
    medida.innerHTML = m.html; medida.value = m.actual;
    $<HTMLSelectElement>("orientacion-cuadro").value = q.h >= q.w ? "v" : "h";
    $<HTMLSelectElement>("paspartu-cuadro").disabled = q.tipo !== "MARCO";
    $<HTMLSelectElement>("paspartu-cuadro").value = String(q.paspartu);
    const e = encuadreDe(c, q), img = fotoDe(c.unaFoto ? c.fotoConjunto : q.foto);
    const min = img ? escalaMinima(marcoDelEncuadre(c, q), { w: img.width, h: img.height }, e) : 1;
    const zoom = $<HTMLInputElement>("zoom");
    zoom.min = String(min); zoom.max = String(Math.max(ESCALA_MAXIMA, min)); zoom.value = String(e.escala);
    $<HTMLInputElement>("inclinacion").value = String(e.incl);
    $("inclinacion-valor").textContent = `${fmt(e.incl)}°`;
    $("encuadrar").textContent = P.encuadrando ? "Listo, terminar encuadre" : "Encuadrar foto";
    $("encuadrar").setAttribute("aria-pressed", String(P.encuadrando));
    $("nota-una-foto").hidden = !c.unaFoto;
  }
  function icono(id: ComposicionId) {
    const c = desdePlantilla(id, 2, 3, 0.45, "IMPRESION", { x: 0, y: 0 }), r = rectanguloDelConjunto(c);
    const sc = Math.min(40 / r.w, 26 / r.h), ox = (44 - r.w * sc) / 2, oy = (30 - r.h * sc) / 2;
    return `<svg viewBox="0 0 44 30" aria-hidden="true">${c.cuadros.map((s) => `<rect x="${(ox + (s.x - r.x) * sc).toFixed(2)}" y="${(oy + (s.y - r.y) * sc).toFixed(2)}" width="${(s.w * sc).toFixed(2)}" height="${(s.h * sc).toFixed(2)}" rx=".6"/>`).join("")}</svg>`;
  }
  let iconosHechos = false;
  function composiciones() {
    const cont = $("composiciones");
    if (!iconosHechos) {
      cont.innerHTML = COMPOSICIONES.map(({ id, label }) => `<button type="button" class="pdc-chip" data-id="${id}">${icono(id)}${label}</button>`).join("");
      iconosHechos = true;
    }
    cont.querySelectorAll<HTMLButtonElement>(".pdc-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === P.plantilla)));
  }
  /** Rearma la plantilla con la medida, orientación y separación del panel, conservando tipo, fotos y encuadres. */
  function rearmar() {
    const c = comp(), [a, b] = MEDIDAS[P.medida], w = P.orient === "v" ? a : b, h = P.orient === "v" ? b : a;
    const tipo = c.cuadros[0]?.tipo ?? "CANVAS";
    const nueva = desdePlantilla(P.plantilla, w, h, P.sep, tipo, centroEnLaPared(c));
    nueva.cuadros = nueva.cuadros.map((q, i) => {
      const viejo = c.cuadros[i];
      return viejo ? { ...q, tipo: viejo.tipo, paspartu: viejo.paspartu, foto: viejo.foto, encuadre: viejo.encuadre } : { ...q, foto: i };
    });
    P.sel = null; P.encuadrando = false;
    confirmar({ ...nueva, unaFoto: c.unaFoto, fotoConjunto: c.fotoConjunto, encuadreConjunto: c.encuadreConjunto });
  }
  function miniaturas() {
    const c = comp(), q = cuadroSel();
    const actual = c.unaFoto ? c.fotoConjunto : q ? q.foto : -1;
    const n = P.fotos.length;
    const idx = actual < 0 || !n ? -1 : ((actual % n) + n) % n;
    $("miniaturas").innerHTML = P.fotos.map((p, i) => `<button type="button" class="pdc-thumb" data-i="${i}" aria-pressed="${i === idx}" aria-label="Foto ${i + 1}"><img src="${p.thumb}" alt=""></button>`).join("");
    $("etiqueta-muestras").hidden = !P.deMuestra;
  }

  // Delegación: el panel se redibuja seguido y los botones cambian; un solo oyente por contenedor.
  const enClick = (n: string, f: (el: HTMLElement) => void) => {
    const cont = $(n), h = (e: Event) => { const el = (e.target as HTMLElement).closest<HTMLElement>("button"); if (el && cont.contains(el)) f(el); };
    cont.addEventListener("click", h); return () => cont.removeEventListener("click", h);
  };
  const enCambio = (n: string, evento: "input" | "change", f: (el: HTMLInputElement) => void) => {
    const el = $<HTMLInputElement>(n), h = () => f(el);
    el.addEventListener(evento, h); return () => el.removeEventListener(evento, h);
  };
  const conSel = (f: (c: Composicion, q: Cuadro) => Composicion) => { const q = cuadroSel(); if (q) confirmar(f(comp(), q)); };
  const conSelProvisorio = (f: (c: Composicion, q: Cuadro) => Composicion) => {
    const q = cuadroSel(); if (!q) return;
    P.provisorio = f(P.hist.actual, q); pedir(); panel();
  };

  const desenlazar = [
    enClick("composiciones", (b) => { P.plantilla = b.dataset.id as ComposicionId; rearmar(); }),
    enClick("tipo-todos", (b) => {
      const tipo = b.dataset.tipo as TipoCuadro;
      confirmar(aplicarATodos(comp(), { tipo, paspartu: tipo === "MARCO" ? 5 : 0 }));
    }),
    enClick("tipo-cuadro", (b) => {
      const tipo = b.dataset.tipo as TipoCuadro;
      conSel((c, q) => cambiarCuadro(c, q.id, { tipo, paspartu: tipo === "MARCO" ? (q.paspartu || 5) : 0 }));
    }),
    enClick("miniaturas", (b) => {
      const i = Number(b.dataset.i), c = comp(), q = cuadroSel();
      if (c.unaFoto) confirmar({ ...c, fotoConjunto: i, encuadreConjunto: ENCUADRE_INICIAL });
      else if (q) confirmar(cambiarCuadro(c, q.id, { foto: i, encuadre: ENCUADRE_INICIAL }));
      else $("nota-fotos").textContent = "Primero tocá un cuadro en la pared para elegir dónde va esta foto.";
    }),
    enCambio("medida-todos", "change", (el) => { P.medida = MEDIDAS.findIndex(([a, b]) => `${a}x${b}` === el.value); rearmar(); }),
    enCambio("orientacion-todos", "change", (el) => { P.orient = el.value; rearmar(); }),
    enCambio("separacion", "input", (el) => { P.sep = Number(el.value); $("separacion-valor").textContent = `${P.sep} cm`; }),
    enCambio("separacion", "change", () => rearmar()),
    enCambio("paspartu-todos", "change", (el) => {
      const c = comp(), pasp = Number(el.value);
      let r = c;
      for (const q of c.cuadros) if (q.tipo === "MARCO") r = cambiarCuadro(r, q.id, { paspartu: pasp });
      confirmar(r);
    }),
    enCambio("una-foto", "change", (el) => confirmar({ ...comp(), unaFoto: el.checked, encuadreConjunto: ENCUADRE_INICIAL })),
    enCambio("medida-cuadro", "change", (el) => conSel((c, q) => {
      const m = leerMedida(el.value, $<HTMLSelectElement>("orientacion-cuadro").value === "v");
      return cambiarMedida(c, q.id, m.w, m.h);
    })),
    enCambio("orientacion-cuadro", "change", (el) => conSel((c, q) => {
      const vertical = el.value === "v", corto = Math.min(q.w, q.h), largo = Math.max(q.w, q.h);
      return cambiarMedida(c, q.id, vertical ? corto : largo, vertical ? largo : corto);
    })),
    enCambio("paspartu-cuadro", "change", (el) => conSel((c, q) => cambiarCuadro(c, q.id, { paspartu: Number(el.value) }))),
    enCambio("zoom", "input", (el) => conSelProvisorio((c, q) => conEncuadre(c, q, (e) => ({ ...e, escala: Number(el.value) })))),
    enCambio("zoom", "change", () => { if (P.provisorio) confirmar(P.provisorio); }),
    enCambio("inclinacion", "input", (el) => conSelProvisorio((c, q) => conEncuadre(c, q, (e) => ({ ...e, incl: Number(el.value) })))),
    enCambio("inclinacion", "change", () => { if (P.provisorio) confirmar(P.provisorio); }),
    enCambio("piso", "change", (el) => { P.piso = el.checked; pedir(); }),
    enCambio("ref-ancho", "input", (el) => { P.refW = clamp(Number(el.value) || 100, 10, 2000); recalcularH(); pedir(); }),
    enCambio("ref-alto", "input", (el) => { P.refH = clamp(Number(el.value) || 100, 10, 2000); recalcularH(); pedir(); }),
  ];
  const botones: Record<string, () => void> = {
    "deshacer": () => { P.hist = deshacer(P.hist); trasHistorial(); },
    "rehacer": () => { P.hist = rehacer(P.hist); trasHistorial(); },
    "modo-pared": () => { P.modoPared = true; seleccionar(null); },
    "modo-ubicar": () => { P.modoPared = false; pedir(); panel(); },
    "encuadrar": () => { P.encuadrando = !P.encuadrando; pedir(); panel(); },
    "rotar-foto": () => conSel((c, q) => conEncuadre(c, q, (e) => ({ ...e, rot90: (((e.rot90 + 90) % 360) as Giro90), cx: 0.5, cy: 0.5, escala: 1 }))),
    "centrar-foto": () => conSel((c, q) => conEncuadre(c, q, (e) => ({ ...e, cx: 0.5, cy: 0.5 }))),
    "inclinacion-cero": () => conSel((c, q) => conEncuadre(c, q, (e) => ({ ...e, incl: 0 }))),
    "duplicar": () => { const q = cuadroSel(); if (q) { const c = duplicarCuadro(comp(), q.id); P.sel = c.cuadros[c.cuadros.length - 1].id; confirmar(c); } },
    "quitar": () => conSel((c, q) => quitarCuadro(c, q.id)),
    "listo": () => seleccionar(null),
    "rotar": () => {
      const c = comp(), n = Math.max(1, P.fotos.length);
      confirmar(c.unaFoto
        ? { ...c, fotoConjunto: (c.fotoConjunto + 1) % n, encuadreConjunto: ENCUADRE_INICIAL }
        : { ...c, cuadros: c.cuadros.map((q) => ({ ...q, foto: (q.foto + 1) % n, encuadre: ENCUADRE_INICIAL })) });
    },
    "centrar": () => { const c = comp(), ce = centroEnLaPared(c); confirmar(moverConjunto(c, P.refW / 2 - ce.x, 0)); },
    "altura-galeria": () => {
      if (!P.piso) { P.piso = true; $<HTMLInputElement>("piso").checked = true; }
      const c = comp(), ce = centroEnLaPared(c); confirmar(moverConjunto(c, 0, P.refH - 150 - ce.y));
    },
  };
  const quitarBotones = Object.entries(botones).map(([n, f]) => { const el = $(n); el.addEventListener("click", f); return () => el.removeEventListener("click", f); });
  const inclinacion = $<HTMLInputElement>("inclinacion");
  inclinacion.min = String(-INCLINACION_MAXIMA); inclinacion.max = String(INCLINACION_MAXIMA);

  function sincronizar() {
    const medida = $<HTMLSelectElement>("medida-todos");
    medida.innerHTML = MEDIDAS.map(([a, b]) => `<option value="${a}x${b}">${a} × ${b} cm</option>`).join("");
    medida.value = `${MEDIDAS[P.medida][0]}x${MEDIDAS[P.medida][1]}`;
    $<HTMLSelectElement>("orientacion-todos").value = P.orient;
    $<HTMLInputElement>("separacion").value = String(P.sep);
    $("separacion-valor").textContent = `${P.sep} cm`;
    $<HTMLSelectElement>("paspartu-todos").innerHTML = `<option value="" disabled>Varios</option>${PASPARTUS.map((p) => `<option value="${p}">${p ? `${p} cm` : "Sin paspartú"}</option>`).join("")}`;
    $<HTMLSelectElement>("paspartu-cuadro").innerHTML = PASPARTUS.map((p) => `<option value="${p}">${p ? `${p} cm` : "Sin paspartú"}</option>`).join("");
    $<HTMLInputElement>("ref-ancho").value = String(P.refW);
    $<HTMLInputElement>("ref-alto").value = String(P.refH);
    $<HTMLInputElement>("piso").checked = P.piso;
  }
  /** Lleva la composición a un centro nuevo de la pared, sin dejar ese salto en el historial. */
  function reubicar(c: Composicion, centro: Punto) {
    const ce = centroEnLaPared(c);
    P.hist = iniciar(moverConjunto(c, centro.x - ce.x, centro.y - ce.y));
    P.sel = null; P.encuadrando = false; P.provisorio = null;
  }
  function usarLiving() {
    const s = livingDeEjemplo();
    P.pared = s.canvas; P.quad = s.quad.map((q) => ({ ...q })); P.refW = s.RW; P.refH = s.RH; P.piso = true; P.modoPared = false;
    recalcularH(); reubicar(P.hist.actual, { x: 185, y: P.refH - 145 }); sincronizar(); pedir(); panel();
  }
  $("living").addEventListener("click", usarLiving);

  const mostrarError = (n: string, texto: string | null) => { const el = $(n); el.textContent = texto ?? ""; el.hidden = !texto; };
  const alElegirPared = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0]; input.value = "";
    if (!f) return;
    mostrarError("error-pared", null);
    try {
      const c = await leerArchivo(f, 2000);
      P.pared = c;
      const W = c.width, H = c.height;
      P.quad = [{ x: W * 0.2, y: H * 0.18 }, { x: W * 0.8, y: H * 0.18 }, { x: W * 0.8, y: H * 0.72 }, { x: W * 0.2, y: H * 0.72 }];
      P.refW = 200; P.refH = 150; P.piso = false; P.modoPared = true;
      recalcularH(); reubicar(P.hist.actual, { x: 100, y: 75 }); sincronizar(); pedir(); panel();
    } catch {
      mostrarError("error-pared", "No pude abrir esa imagen. Probá con una foto en JPG o PNG.");
    }
  };
  const alElegirFotos = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement, archivos = [...(input.files ?? [])]; input.value = "";
    if (!archivos.length) return;
    mostrarError("error-fotos", null);
    const nuevas: Foto[] = [];
    let malas = 0;
    for (const f of archivos) {
      try { const c = await leerArchivo(f, 1600); nuevas.push({ img: c, thumb: miniatura(c) }); } catch { malas++; }
    }
    if (nuevas.length) {
      let c = P.hist.actual;
      if (P.deMuestra) {
        P.fotos = []; P.deMuestra = false;
        c = { ...c, fotoConjunto: 0, encuadreConjunto: ENCUADRE_INICIAL, cuadros: c.cuadros.map((q, i) => ({ ...q, foto: i, encuadre: ENCUADRE_INICIAL })) };
      }
      const desde = P.fotos.length; P.fotos = [...P.fotos, ...nuevas];
      const q = cuadroSel();
      if (nuevas.length === 1 && c.unaFoto) c = { ...c, fotoConjunto: desde, encuadreConjunto: ENCUADRE_INICIAL };
      else if (nuevas.length === 1 && q) c = cambiarCuadro(c, q.id, { foto: desde, encuadre: ENCUADRE_INICIAL });
      $("nota-fotos").textContent = "Tocá un cuadro en la pared y después una foto para ponerla ahí.";
      confirmar(c);
    }
    if (malas) mostrarError("error-fotos", `${malas === 1 ? "Una foto no se pudo abrir" : `${malas} fotos no se pudieron abrir`}. Probá con JPG o PNG.`);
  };
  $("archivo-pared").addEventListener("change", alElegirPared);
  $("archivo-fotos").addEventListener("change", alElegirFotos);

  const modal = $("modal");
  const cerrarModal = () => { modal.hidden = true; };
  const verFinal = () => {
    dibujar(true); $<HTMLImageElement>("imagen-final").src = cv.toDataURL("image/jpeg", 0.92); dibujar(false);
    modal.hidden = false; $("cerrar-modal").focus();
  };
  const alTocarModal = (e: MouseEvent) => { if (e.target === modal) cerrarModal(); };
  $("ver-final").addEventListener("click", verFinal);
  $("cerrar-modal").addEventListener("click", cerrarModal);
  modal.addEventListener("click", alTocarModal);

  /* ---------- Arranque: un escalonado de canvas con una sola foto, como las referencias ---------- */
  P.fotos = PALETAS.map((_, i) => { const c = fotoDeMuestra(i); return { img: c, thumb: miniatura(c) }; });
  const [a0, b0] = MEDIDAS[P.medida];
  P.hist = iniciar({ ...desdePlantilla(P.plantilla, a0, b0, P.sep, "CANVAS", { x: 0, y: 0 }), unaFoto: true, fotoConjunto: 1 });
  usarLiving();

  return () => {
    cancelAnimationFrame(raf);
    if (ruedaPendiente) clearTimeout(ruedaPendiente);
    cv.removeEventListener("pointerdown", alApoyar); cv.removeEventListener("pointermove", alMover);
    cv.removeEventListener("pointerup", alSoltar); cv.removeEventListener("pointercancel", alSoltar);
    cv.removeEventListener("dblclick", alDobleToque); cv.removeEventListener("wheel", alGirarRueda);
    document.removeEventListener("keydown", alTeclear); window.removeEventListener("resize", alRedimensionar);
    $("living").removeEventListener("click", usarLiving);
    $("archivo-pared").removeEventListener("change", alElegirPared);
    $("archivo-fotos").removeEventListener("change", alElegirFotos);
    $("ver-final").removeEventListener("click", verFinal);
    $("cerrar-modal").removeEventListener("click", cerrarModal);
    modal.removeEventListener("click", alTocarModal);
    desenlazar.forEach((d) => d()); quitarBotones.forEach((d) => d());
    gl?.gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
