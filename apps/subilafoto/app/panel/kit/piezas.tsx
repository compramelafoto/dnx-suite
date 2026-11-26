"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Paleta } from "@/lib/kit/colores";
import { FOLLETO, FORMATOS, dibujarFolleto, dibujarPlaca, type Formato, type Pieza } from "./dibujo";

type Props = {
  nombre: string;
  precio: string;
  enlace: string;
  paleta: Paleta;
  /** Si el fotógrafo subió su logo al bucket. Si no, la pieza lleva su nombre. */
  tieneLogo: boolean;
  /** Para el nombre de los archivos: "estudio-luz-historia.png". */
  slug: string;
};

const ORDEN: Formato[] = ["historia", "publicacion", "cuadrada"];

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = src;
  });
}

/**
 * La familia de Montserrat tal como la nombró `next/font` (con un sufijo propio), ya
 * cargada. Sin esperar la carga, el primer dibujo sale con la letra del sistema.
 */
async function fuenteDeLaMarca(): Promise<string> {
  const variable = getComputedStyle(document.documentElement).getPropertyValue("--slf-font").trim();
  const familia = variable || "sans-serif";
  await Promise.all(
    [400, 500, 800].map((peso) => document.fonts.load(`${peso} 40px ${familia}`).catch(() => null)),
  );
  return familia;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function aPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolver, rechazar) =>
    canvas.toBlob((b) => (b ? resolver(b) : rechazar(new Error("No se pudo armar la imagen."))), "image/png"),
  );
}

export function Piezas({ nombre, precio, enlace, paleta, tieneLogo, slug }: Props) {
  const [pieza, setPieza] = useState<Pieza | null>(null);
  const [armandoPdf, setArmandoPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lienzos = useRef<Partial<Record<Formato | "folleto", HTMLCanvasElement | null>>>({});

  useEffect(() => {
    let vigente = true;
    (async () => {
      const [familia, logo] = await Promise.all([
        fuenteDeLaMarca(),
        tieneLogo ? cargarImagen("/api/panel/logo") : Promise.resolve(null),
      ]);
      const qr = document.createElement("canvas");
      // Oscuro sobre blanco y con margen: un QR de colores queda lindo y no se lee.
      await QRCode.toCanvas(qr, enlace, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 600,
        color: { dark: "#200638", light: "#FFFFFF" },
      });
      if (!vigente) return;
      setPieza({
        nombre,
        precio,
        enlaceCorto: enlace.replace(/^https?:\/\//, ""),
        paleta,
        logo,
        qr,
        fuente: familia,
      });
    })().catch(() => setError("No pudimos preparar las piezas. Recargá la página."));
    return () => {
      vigente = false;
    };
  }, [nombre, precio, enlace, paleta, tieneLogo]);

  useEffect(() => {
    if (!pieza) return;
    for (const formato of ORDEN) {
      const c = lienzos.current[formato];
      const ctx = c?.getContext("2d");
      if (ctx) dibujarPlaca(ctx, formato, pieza);
    }
    const f = lienzos.current.folleto?.getContext("2d");
    if (f) dibujarFolleto(f, pieza);
  }, [pieza]);

  async function bajarPlaca(formato: Formato) {
    const c = lienzos.current[formato];
    if (!c) return;
    descargar(await aPng(c), `${slug}-${formato}.png`);
  }

  async function bajarFolleto() {
    const c = lienzos.current.folleto;
    if (!c) return;
    setArmandoPdf(true);
    setError(null);
    try {
      // Se carga recién al pedirlo: no tiene sentido que lo baje quien sólo quiere una placa.
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.setTitle(`${nombre} — Fotos de los invitados`);
      pdf.setAuthor(nombre);
      const imagen = await pdf.embedPng(await (await aPng(c)).arrayBuffer());
      // A4 en puntos.
      const pagina = pdf.addPage([595.28, 841.89]);
      pagina.drawImage(imagen, { x: 0, y: 0, width: 595.28, height: 841.89 });
      const bytes = await pdf.save();
      descargar(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${slug}-folleto.pdf`);
    } catch {
      setError("No pudimos armar el PDF. Probá de nuevo.");
    } finally {
      setArmandoPdf(false);
    }
  }

  return (
    <>
      <section className="mt-14" aria-labelledby="titulo-placas">
        <h2 id="titulo-placas" className="text-xl font-extrabold">Placas para redes</h2>
        <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Con tu marca, tu precio y un QR que lleva a tu enlace de venta. Bajalas y subilas
          tal cual.
        </p>

        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {ORDEN.map((formato) => {
            const f = FORMATOS[formato];
            return (
              <li key={formato} className="flex flex-col">
                <canvas
                  ref={(el) => {
                    lienzos.current[formato] = el;
                  }}
                  width={f.ancho}
                  height={f.alto}
                  className="w-full rounded-xl border"
                  style={{ borderColor: "var(--slf-borde)", background: paleta.fondo }}
                  role="img"
                  aria-label={`Vista previa de la placa ${f.nombre.toLowerCase()}`}
                />
                <p className="mt-3 font-extrabold">{f.nombre}</p>
                <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>{f.uso}</p>
                <button
                  type="button"
                  onClick={() => bajarPlaca(formato)}
                  disabled={!pieza}
                  className="mt-3 min-h-[44px] rounded-xl px-5 font-extrabold text-white disabled:opacity-50"
                  style={{ background: "var(--slf-violeta)" }}
                >
                  Descargar
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="titulo-folleto">
        <h2 id="titulo-folleto" className="text-xl font-extrabold">Folleto</h2>
        <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Una hoja A4 que explica cómo funciona, qué incluye y cuánto cuesta. Para mandarla
          por correo o imprimirla y llevarla a una reunión.
        </p>
        <div className="mt-6 grid items-start gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
          <canvas
            ref={(el) => {
              lienzos.current.folleto = el;
            }}
            width={FOLLETO.ancho}
            height={FOLLETO.alto}
            className="w-full rounded-xl border bg-white"
            style={{ borderColor: "var(--slf-borde)" }}
            role="img"
            aria-label="Vista previa del folleto"
          />
          <div>
            <button
              type="button"
              onClick={bajarFolleto}
              disabled={!pieza || armandoPdf}
              className="min-h-[44px] rounded-xl px-6 font-extrabold text-white disabled:opacity-50"
              style={{ background: "var(--slf-violeta)" }}
            >
              {armandoPdf ? "Armando el PDF…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="mt-6 text-sm font-extrabold" style={{ color: "#b00020" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
