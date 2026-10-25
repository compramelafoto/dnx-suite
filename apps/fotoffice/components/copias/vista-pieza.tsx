"use client";

import { useEffect, useRef } from "react";
import { aplicarAjustes } from "@/lib/impresion/ajustes";
import type { Papel } from "@/lib/impresion/encuadre";
import { cajaRotada, planDeRecorte } from "@/lib/impresion/geometria";
import { anguloTotal, colorBordeDe, type Receta } from "@/lib/impresion/receta";
import { useImagen } from "@/components/foto-carnet/vistas";

/**
 * Así sale la copia, con los ajustes: el mismo `planDeRecorte` que usa el servidor, sobre la
 * vista previa (1600 px). Como en el servidor, los ajustes se aplican sólo a la foto y el borde
 * (y, en ENCAJAR, las esquinas que deja el enderezado) queda exactamente de su color.
 * Es SÓLO para mirar: el archivo que se imprime lo arma el servidor desde el original.
 */
export function VistaPieza({ src, receta, papelMm, ancho = 480 }: { src: string; receta: Receta; papelMm: Papel; ancho?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const trabajo = useRef<HTMLCanvasElement | null>(null);
  const img = useImagen(src);
  const alto = Math.max(1, Math.round((ancho * papelMm.altoMm) / papelMm.anchoMm));

  useEffect(() => {
    if (!img) return;
    // Un dibujo por cuadro como mucho: mover un control no recalcula en cada evento.
    const id = requestAnimationFrame(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = ancho;
      canvas.height = alto;
      const angulo = anguloTotal(receta);
      const caja = cajaRotada(img.naturalWidth, img.naturalHeight, angulo);
      const plan = planDeRecorte(receta, caja, { ancho, alto });
      const c = plan.colocacion;
      const r = plan.recorte;
      const encajar = receta.modo === "ENCAJAR";

      // 1: la foto sola, en su lugar del papel, en un lienzo aparte del tamaño que ocupa.
      trabajo.current ??= document.createElement("canvas");
      const t = trabajo.current;
      t.width = c.width;
      t.height = c.height;
      const tc = t.getContext("2d", { willReadFrequently: true });
      if (!tc) return;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, c.width, c.height);
      // RECORTAR: el giro deja blanco y ese blanco pasa por los ajustes (como en el servidor y en
      // la etapa 1). ENCAJAR: transparente, así esas esquinas toman el color exacto del borde.
      if (!encajar) {
        tc.fillStyle = "#ffffff";
        tc.fillRect(0, 0, c.width, c.height);
      }
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = "high";
      // Del recorte (px de la caja girada) a su lugar: lo mismo que extract + resize en el servidor.
      tc.scale(c.width / r.width, c.height / r.height);
      tc.translate(-r.left + caja.ancho / 2, -r.top + caja.alto / 2);
      tc.rotate((angulo * Math.PI) / 180);
      tc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      // 2: los ajustes, sólo sobre la foto (el alfa no se toca).
      const datos = tc.getImageData(0, 0, c.width, c.height);
      aplicarAjustes(datos.data, 4, receta.ajustes);
      tc.putImageData(datos, 0, 0);

      // 3: el papel (borde del color elegido en ENCAJAR) y la foto encima.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = encajar ? colorBordeDe(receta) : "#ffffff";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.drawImage(t, c.left, c.top);
    });
    return () => cancelAnimationFrame(id);
  }, [img, receta, ancho, alto]);

  return (
    <div className="mx-auto w-full max-w-md rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-black/10 p-3">
      {/* El tamaño del lienzo da la proporción del papel: se achica a lo ancho sin deformarse. */}
      <canvas
        ref={ref}
        width={ancho}
        height={alto}
        role="img"
        className="block h-auto w-full"
        aria-label="Vista previa de la copia con los ajustes"
      />
    </div>
  );
}
