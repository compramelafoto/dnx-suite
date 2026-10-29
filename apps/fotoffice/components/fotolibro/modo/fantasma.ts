"use client";

/**
 * La imagen que acompaña al mouse al arrastrar. El navegador, por su cuenta, usa el elemento
 * arrastrado a su tamaño real: una foto del pliego mide miles de píxeles (el pliego se ve achicado),
 * y el fantasma tapaba toda la pantalla. Esto pone una miniatura chica, con la cantidad si son varias.
 */
export function ponerFantasma(e: React.DragEvent, src: string | null, cantidad = 1, aspecto = 1.5) {
  if (typeof document === "undefined" || !e.dataTransfer.setDragImage) return;
  const lado = 110;
  const w = aspecto >= 1 ? lado : Math.round(lado * aspecto);
  const h = aspecto >= 1 ? Math.round(lado / aspecto) : lado;
  const caja = document.createElement("div");
  caja.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${w}px;height:${h}px;border-radius:4px;overflow:visible;box-shadow:0 6px 18px rgba(0,0,0,.45);background:#334155;outline:2px solid #facc15;`;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:4px;display:block;";
    caja.appendChild(img);
  }
  if (cantidad > 1) {
    const n = document.createElement("span");
    n.textContent = String(cantidad);
    n.style.cssText = "position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#facc15;color:#111;font:600 12px/20px system-ui;text-align:center;";
    caja.appendChild(n);
  }
  document.body.appendChild(caja);
  e.dataTransfer.setDragImage(caja, w / 2, h / 2);
  // El navegador ya sacó la "foto" del fantasma: el elemento se puede sacar.
  setTimeout(() => caja.remove(), 0);
}
