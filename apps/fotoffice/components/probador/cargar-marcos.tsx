"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { activarModeloMarcoAction, guardarModeloMarcoAction } from "@/app/(shell)/probador/marcos/actions";
import { aLaPared, homografia, invertir, proyectar, type Punto } from "@/lib/probador/geometria";
import type { Medida, ModeloMarco } from "@/lib/probador/marcos";

/**
 * Cargar los modelos de marco del probador: por cada producto marco y color, una foto de frente.
 * El estudio marca las 4 esquinas de afuera y las 4 de la ventana; el navegador endereza la foto
 * (con la misma homografía del probador) y deja la ventana transparente. Se sube como PNG.
 */

export type ProductoParaCargar = {
  productoId: string;
  nombre: string;
  colores: { color: string; medidas: { foto: Medida; exterior: Medida | null }[]; modelo: (ModeloMarco & { activo: boolean }) | null }[];
};

const ANCHO_SALIDA = 1000;

export function CargarMarcos({ productos }: { productos: ProductoParaCargar[] }) {
  const [editando, setEditando] = useState<{ productoId: string; nombre: string; color: string; medidas: { foto: Medida; exterior: Medida | null }[] } | null>(null);
  const [pendiente, empezar] = useTransition();
  if (!productos.length) {
    return <p className="fo-card p-5 text-sm">No hay productos de marco en Ventas. Los marcos se reconocen por el nombre: «Marco…» o «Cuadro portarretratos de madera…».</p>;
  }
  return (
    <div className="space-y-4">
      {productos.map((p) => (
        <section key={p.productoId} className="fo-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">{p.nombre}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.colores.map((c) => (
              <li key={c.color} className="flex items-center gap-3 rounded-lg border border-[var(--fo-border)] p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-[var(--fo-surface-muted)]">
                  {c.modelo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura del PNG del marco
                    <img src={c.modelo.imagenUrl} alt="" className="max-h-16 max-w-16 object-contain" />
                  ) : <span className="text-xs text-[var(--fo-muted)]">Sin foto</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{c.color}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {c.modelo ? (c.modelo.activo ? "En el probador" : "Cargado, apagado") : "Falta la foto de frente"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setEditando({ productoId: p.productoId, nombre: p.nombre, color: c.color, medidas: c.medidas })}>
                      {c.modelo ? "Cambiar foto" : "Cargar foto de frente"}
                    </button>
                    {c.modelo ? (
                      <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => empezar(async () => { await activarModeloMarcoAction(c.modelo!.id, !c.modelo!.activo); })}>
                        {c.modelo.activo ? "Apagar" : "Encender"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editando ? <EnderezarMarco {...editando} alCerrar={() => setEditando(null)} /> : null}
    </div>
  );
}

type Esquinas = Punto[];
const rectInicial = (W: number, H: number, k: number): Esquinas => [
  { x: W * k, y: H * k }, { x: W * (1 - k), y: H * k }, { x: W * (1 - k), y: H * (1 - k) }, { x: W * k, y: H * (1 - k) },
];

/** Endereza la foto: lleva el cuadrilátero de afuera a un rectángulo y vacía la ventana. */
export function enderezar(img: HTMLCanvasElement, afuera: Esquinas, ventana: Esquinas, anchoCm: number, altoCm: number) {
  const W = ANCHO_SALIDA, H = Math.round((ANCHO_SALIDA * altoCm) / anchoCm);
  const destino = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const Hm = homografia(destino, afuera);
  if (!Hm) return null;
  const src = img.getContext("2d")!.getImageData(0, 0, img.width, img.height);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const g = out.getContext("2d")!;
  const dst = g.createImageData(W, H);
  const sw = img.width, sh = img.height, s = src.data, d = dst.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = proyectar(Hm, x + 0.5, y + 0.5);
      const fx = Math.min(sw - 1.001, Math.max(0, p.x - 0.5)), fy = Math.min(sh - 1.001, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        d[o + c] = (s[i00 + c] * (1 - ax) + s[i10 + c] * ax) * (1 - ay) + (s[i01 + c] * (1 - ax) + s[i11 + c] * ax) * ay;
      }
      d[o + 3] = 255;
    }
  }
  g.putImageData(dst, 0, 0);
  // La ventana, llevada al rectángulo enderezado: se vacía y se guarda su caja.
  const Hi = invertir(Hm);
  const v = ventana.map((p) => aLaPared(Hi, p)).filter((p): p is Punto => p !== null);
  if (v.length !== 4) return null;
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); v.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill();
  const xs = v.map((p) => p.x), ys = v.map((p) => p.y);
  const x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
  const caja = { x: x0, y: y0, w: Math.min(W, Math.max(...xs)) - x0, h: Math.min(H, Math.max(...ys)) - y0 };
  return { canvas: out, ventana: caja };
}

function EnderezarMarco(props: { productoId: string; nombre: string; color: string; medidas: { foto: Medida; exterior: Medida | null }[]; alCerrar: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [foto, setFoto] = useState<HTMLCanvasElement | null>(null);
  const [afuera, setAfuera] = useState<Esquinas>([]);
  const [ventana, setVentana] = useState<Esquinas>([]);
  const conExterior = props.medidas.find((m) => m.exterior);
  const [ancho, setAncho] = useState(conExterior?.exterior ? String(conExterior.exterior.corto) : "");
  const [alto, setAlto] = useState(conExterior?.exterior ? String(conExterior.exterior.largo) : "");
  const [estado, setEstado] = useState<string | null>(null);
  const arrastre = useRef<{ cual: "afuera" | "ventana"; i: number } | null>(null);

  useEffect(() => {
    const c = lienzo.current;
    if (!c || !foto) return;
    c.width = foto.width; c.height = foto.height;
    const g = c.getContext("2d")!;
    g.drawImage(foto, 0, 0);
    const f = foto.width / (c.getBoundingClientRect().width || foto.width);
    const dibujar = (pts: Esquinas, color: string) => {
      g.strokeStyle = color; g.lineWidth = 3 * f; g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.stroke();
      for (const p of pts) { g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, 11 * f, 0, 7); g.fill(); g.stroke(); }
    };
    dibujar(afuera, "#2563eb");
    dibujar(ventana, "#ea580c");
  }, [foto, afuera, ventana]);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const bmp = await createImageBitmap(f);
    const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    setFoto(c);
    setAfuera(rectInicial(c.width, c.height, 0.1));
    setVentana(rectInicial(c.width, c.height, 0.25));
  }

  const punto = (e: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };
  function apoyar(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = punto(e), f = e.currentTarget.width / e.currentTarget.getBoundingClientRect().width;
    let mejor: { cual: "afuera" | "ventana"; i: number; d: number } | null = null;
    for (const [cual, pts] of [["ventana", ventana], ["afuera", afuera]] as const) {
      pts.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 34 * f && (!mejor || d < mejor.d)) mejor = { cual, i, d }; });
    }
    if (mejor) { arrastre.current = mejor; e.currentTarget.setPointerCapture(e.pointerId); }
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    const a = arrastre.current;
    if (!a) return;
    const p = punto(e);
    (a.cual === "afuera" ? setAfuera : setVentana)((pts) => pts.map((q, i) => (i === a.i ? p : q)));
  }

  async function guardar() {
    const w = Number(ancho), h = Number(alto);
    if (!foto || !(w >= 5 && h >= 5)) return setEstado("Cargá la medida de afuera del marco de la foto.");
    // El ancho y el alto se toman en la orientación en que está la foto.
    const fotoVertical = Math.hypot(afuera[3].x - afuera[0].x, afuera[3].y - afuera[0].y) >= Math.hypot(afuera[1].x - afuera[0].x, afuera[1].y - afuera[0].y);
    const [anchoCm, altoCm] = fotoVertical ? [Math.min(w, h), Math.max(w, h)] : [Math.max(w, h), Math.min(w, h)];
    const r = enderezar(foto, afuera, ventana, anchoCm, altoCm);
    if (!r) return setEstado("No pudimos enderezar la foto. Revisá que las esquinas estén en orden y sin cruzarse.");
    setEstado("Subiendo…");
    const blob = await new Promise<Blob | null>((ok) => r.canvas.toBlob(ok, "image/png"));
    if (!blob) return setEstado("No pudimos generar la imagen.");
    const body = new FormData();
    body.append("file", new File([blob], `marco-${props.color}.png`, { type: "image/png" }));
    body.append("preset", "frameModel");
    const res = await fetch("/api/uploads/image", { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) return setEstado(json.error ?? "No se pudo subir la imagen.");
    const g = await guardarModeloMarcoAction({
      productId: props.productoId, color: props.color, imagenUrl: json.url,
      imagenAncho: r.canvas.width, imagenAlto: r.canvas.height, ventana: r.ventana,
      exteriorAnchoCm: anchoCm, exteriorAltoCm: altoCm,
    });
    if (!g.ok) return setEstado(g.error);
    props.alCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="fo-card max-h-full w-full max-w-3xl space-y-3 overflow-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{props.nombre} · {props.color}</h2>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={props.alCerrar}>Cerrar</button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--fo-text-secondary)]">
          <li>Sacale una foto al marco <b>de frente</b>, sobre una mesa o la pared, sin foto adentro (o con una lisa).</li>
          <li>Arrastrá los puntos <b style={{ color: "#2563eb" }}>azules</b> a las 4 esquinas de afuera del marco y los <b style={{ color: "#ea580c" }}>naranjas</b> a las 4 esquinas del hueco.</li>
          <li>Escribí cuánto mide el marco de la foto <b>por fuera</b>.</li>
        </ol>
        <input type="file" accept="image/*" onChange={elegir} />
        {foto ? (
          <canvas ref={lienzo} className="block w-full touch-none rounded" onPointerDown={apoyar} onPointerMove={mover} onPointerUp={() => (arrastre.current = null)} />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Ancho por fuera (cm)
            <input className="fo-input mt-1 block w-28" type="number" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} />
          </label>
          <label className="text-sm">Alto por fuera (cm)
            <input className="fo-input mt-1 block w-28" type="number" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} />
          </label>
          <button type="button" className="fo-btn fo-btn-primary" disabled={!foto} onClick={guardar}>Enderezar y guardar</button>
        </div>
        {estado ? <p className="text-sm text-[var(--fo-muted)]">{estado}</p> : null}
      </div>
    </div>
  );
}
