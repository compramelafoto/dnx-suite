"use client";

import { useEffect, useState } from "react";
import { GuidedTour } from "@repo/guided-tour";
import type { TourDefinition } from "@repo/guided-tour";

/**
 * Los recorridos guiados del probador de cuadros: uno para el cliente (sitio público) y otro para
 * el estudio (panel). Señalan los `data-tour="probador-…"` de `ProbadorCuadros` y, en el panel,
 * de `EnlaceParaClientes`. Los pasos cuyo bloque no está a la vista (el presupuesto sin catálogo,
 * el enlace sin dirección pública) se saltean solos. Los ids van escritos tal cual en las páginas
 * (`TourHelpButton`): no se importan de acá porque este módulo es de cliente.
 */
const TOUR_PROBADOR_CLIENTE_ID = "probador-cuadros-cliente";
const TOUR_PROBADOR_ESTUDIO_ID = "probador-cuadros-estudio";

const TOUR_CLIENTE: TourDefinition = {
  id: TOUR_PROBADOR_CLIENTE_ID,
  version: 1,
  screenName: "el probador de cuadros",
  intro: "Te mostramos en un minuto cómo ver tus cuadros en tu propia pared antes de pedirlos.",
  steps: [
    {
      title: "Probá antes de comprar",
      body: "Sacale una foto a tu pared, marcá algo cuya medida conozcas y mirá a escala real cómo quedan los cuadros antes de pedirlos.",
      placement: "center",
    },
    {
      target: '[data-tour="probador-pared"]',
      title: "Tu pared",
      body: "Tocá «Sacar o subir foto» para usar una foto de tu pared. Mientras tanto, podés probar con el living de ejemplo.",
    },
    {
      target: '[data-tour="probador-referencia"]',
      title: "Una medida que conozcas",
      body: "En «1 · Marcar pared» llevá los 4 puntos a las esquinas de algo que sepas cuánto mide (una puerta, un mueble o la pared) y anotá acá su ancho y alto. Así los cuadros se ven del tamaño real.",
    },
    {
      target: '[data-tour="probador-lienzo"]',
      title: "Tu pared con los cuadros",
      body: "Arrastrá para mover todo el conjunto. Tocá un cuadro para cambiarle solo a él la medida, el encuadre de la foto, la inclinación o el paspartú.",
    },
    {
      target: '[data-tour="probador-conjunto"]',
      title: "Elegí el conjunto",
      body: "Probá un cuadro solo, un díptico, un tríptico, un escalonado o una galería, con la medida, la orientación y la separación que quieras.",
    },
    {
      target: '[data-tour="probador-tipo"]',
      title: "Canvas, MDF o con marco",
      body: "Elegí cómo querés tus cuadros: impresión, canvas, MDF o con marco. Con marco también podés sumarle paspartú.",
    },
    {
      target: '[data-tour="probador-fotos"]',
      title: "Poné tus fotos",
      body: "Agregá tus fotos, tocá un cuadro en la pared y después la foto que va ahí. Tus fotos no salen de tu celular o computadora.",
    },
    {
      target: '[data-tour="probador-posicion"]',
      title: "A la altura justa",
      body: "Centrá el conjunto a lo ancho o dejá su centro a 150 cm del piso, la altura a la que se suelen colgar.",
    },
    {
      target: '[data-tour="probador-deshacer"]',
      title: "Volver atrás",
      body: "Si algo no te gustó, deshacelo con estas flechas o con ⌘Z (Ctrl+Z en Windows).",
    },
    {
      target: '[data-tour="probador-presupuesto"]',
      title: "Cuánto sale",
      body: "Acá ves el precio de cada cuadro y el total de lo que armaste.",
    },
    {
      target: '[data-tour="probador-ver-final"]',
      title: "Guardá cómo queda",
      body: "Generá la imagen de tu pared con los cuadros, guardala y mandásela al estudio para hacer tu pedido.",
    },
    {
      target: '[data-tour="ayuda"]',
      title: "¿Querés repasarlo?",
      body: "Tocá «Ayuda» cuando quieras para volver a ver este recorrido.",
    },
  ],
};

const TOUR_ESTUDIO: TourDefinition = {
  id: TOUR_PROBADOR_ESTUDIO_ID,
  version: 1,
  screenName: "el probador de cuadros",
  intro: "Te mostramos cómo usar el probador con tus clientes y cómo compartirles la versión para que prueben en su casa.",
  steps: [
    {
      title: "Mostrale cómo queda",
      body: "Con una foto de la pared del cliente y una medida conocida, le mostrás a escala cómo quedan los cuadros y cuánto salen, en el mostrador o en una reunión.",
      placement: "center",
    },
    {
      target: '[data-tour="probador-enlace"]',
      title: "Enlace para tus clientes",
      body: "Copiá este enlace y mandáselo al cliente para que pruebe con su propia pared desde su casa. Es la versión pública, dentro de tu sitio.",
    },
    {
      target: '[data-tour="probador-pared"]',
      title: "La pared del cliente",
      body: "Sacale o subí una foto de la pared del cliente. Si todavía no la tenés, mostrale el living de ejemplo.",
    },
    {
      target: '[data-tour="probador-referencia"]',
      title: "Calibrá con una medida",
      body: "En «1 · Marcar pared» llevá los 4 puntos a algo cuya medida conozcas y cargá acá su ancho y alto: así todo queda a escala real.",
    },
    {
      target: '[data-tour="probador-lienzo"]',
      title: "Editá sobre la pared",
      body: "Arrastrá para mover el conjunto. Tocá un cuadro para editarlo solo: medida, orientación, encuadre, rotación, inclinación, paspartú, duplicarlo o quitarlo.",
    },
    {
      target: '[data-tour="probador-conjunto"]',
      title: "Armá el conjunto",
      body: "Elegí individual, díptico, tríptico, escalonado, grilla o galería, y la medida base, la orientación y la separación entre cuadros.",
    },
    {
      target: '[data-tour="probador-tipo"]',
      title: "Tipo de cuadro",
      body: "Impresión, canvas, MDF o con marco, para todos juntos. Las medidas que se ofrecen son las que tienen precio en tu catálogo de Ventas.",
    },
    {
      target: '[data-tour="probador-fotos"]',
      title: "Las fotos del cliente",
      body: "Cargá sus fotos para reemplazar las muestras; tocá un cuadro y después una foto para ponerla ahí. Nada se sube: todo queda en este equipo.",
    },
    {
      target: '[data-tour="probador-deshacer"]',
      title: "Deshacer y rehacer",
      body: "Volvé atrás o adelante con estas flechas, o con ⌘Z y ⇧⌘Z (Ctrl en Windows).",
    },
    {
      target: '[data-tour="probador-presupuesto"]',
      title: "Presupuesto al instante",
      body: "Sale de los precios de tu catálogo de Ventas. Si una medida no tiene precio, avisa que se presupuesta aparte.",
    },
    {
      target: '[data-tour="probador-ver-final"]',
      title: "Imagen para el cliente",
      body: "Generá la imagen final de la pared con los cuadros para guardarla y mandársela junto con el presupuesto.",
    },
    {
      target: '[data-tour="ayuda"]',
      title: "¿Querés repasarlo?",
      body: "Tocá «Ayuda» cuando quieras para volver a ver este recorrido.",
    },
  ],
};

/**
 * Pasa cualquier color CSS a `#rrggbb`, que es lo que entiende el recorrido para armar su tono
 * suave. Lo resuelve el propio navegador con un canvas; si no puede, devuelve `null`.
 */
function aHex(color: string): string | null {
  const limpio = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(limpio)) return limpio;
  if (!limpio) return null;
  try {
    const g = document.createElement("canvas").getContext("2d");
    if (!g) return null;
    g.fillStyle = "#000000";
    g.fillStyle = limpio;
    const v = String(g.fillStyle);
    return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Monta el recorrido con el color de acento del probador (`--pdc-accent`, que en el sitio público
 * es el color principal del estudio y en el panel el acento del panel).
 */
export function TourProbador({ variante }: { variante: "cliente" | "estudio" }) {
  const [acento, setAcento] = useState<string>(variante === "cliente" ? "#2b6a5f" : "#0ea5e9");

  useEffect(() => {
    // Se lee en el cuadro siguiente, con el probador ya pintado y sus variables resueltas.
    const id = requestAnimationFrame(() => {
      const raiz = document.querySelector(".pdc");
      const hex = raiz ? aHex(getComputedStyle(raiz).getPropertyValue("--pdc-accent")) : null;
      if (hex) setAcento(hex);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return <GuidedTour tour={variante === "cliente" ? TOUR_CLIENTE : TOUR_ESTUDIO} accentColor={acento} />;
}
