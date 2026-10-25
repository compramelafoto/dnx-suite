/**
 * Correo al autor de una obra: "tu obra va a estar en la tienda" (bases que ya lo permiten) o
 * "¿nos das permiso?" (bases que no lo prevén). Funciones PURAS: `consent.ts` junta los datos.
 *
 * Lo lee un fotógrafo que quizá nunca oyó hablar de FOTOFFICE: castellano llano, qué significa
 * para él, cuánto cobra y que puede decir que no sin dar explicaciones. Sin datos de otros
 * autores. La imagen sólo si la institución ya guardó la vista previa en su R2: nunca un enlace
 * firmado de FotoRank, que vence a los 10 minutos y el correo se lee días después.
 */
import { C, escapeHtml } from "@/lib/communications/html";
import { formatMinorArs } from "@/lib/membership/money";

import { armar, parrafo, type Bloque, type RenderedEmail } from "../email-render";
import type { ConsentBasis } from "./consent-basis";

export type ArtworkConsentEmail = {
  basis: ConsentBasis;
  institution: string;
  authorName: string | null;
  contestTitle: string;
  artworkTitle: string;
  /** Vista previa ya guardada en el R2 de FOTOFFICE (sólo https). null = sin imagen. */
  previewUrl: string | null;
  royaltyBps: number;
  formats: { name: string; widthCm: number; heightCm: number; priceMinor: number }[];
  url: string;
  expiresAt: Date;
};

/** `/obras/permiso/<token>` en el dominio propio (si está conectado) o en el de FOTOFFICE. */
export function buildConsentUrl(input: {
  customDomain: string | null;
  appOrigin: string;
  slug: string | null;
  token: string;
}): string | null {
  const ruta = `/obras/permiso/${encodeURIComponent(input.token)}`;
  if (input.customDomain) return `https://${input.customDomain}${ruta}`;
  if (!input.appOrigin || !input.slug) return null;
  return `${input.appOrigin}/w/${encodeURIComponent(input.slug)}${ruta}`;
}

/** 2000 → "20 %"; 1250 → "12,5 %". */
export function royaltyPercentLabel(bps: number): string {
  return `${(bps / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}

function fechaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function imagen(url: string | null, alt: string): Bloque | null {
  if (!url || !/^https:\/\//i.test(url)) return null;
  return {
    text: [],
    html: `<p style="margin:0 0 16px;"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="540" style="display:block;width:100%;max-width:540px;height:auto;border-radius:8px;border:1px solid ${C.borde};"></p>`,
  };
}

function formatos(e: ArtworkConsentEmail): Bloque | null {
  if (e.formats.length === 0) return null;
  const renglon = (f: ArtworkConsentEmail["formats"][number]) =>
    `${f.name} (${f.widthCm} × ${f.heightCm} cm): ${formatMinorArs(f.priceMinor)}`;
  return {
    text: ["Cómo se ofrecería:", ...e.formats.map((f) => `- ${renglon(f)}`)],
    html: `<p style="margin:8px 0 6px;font-size:13px;font-weight:700;color:${C.tinta};">Cómo se ofrecería</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:${C.cuerpo};">${e.formats
      .map((f) => `<li>${escapeHtml(renglon(f))}</li>`)
      .join("")}</ul>`,
  };
}

export function renderArtworkConsentEmail(e: ArtworkConsentEmail): RenderedEmail {
  const obra = `«${e.artworkTitle}»`;
  const regalia = royaltyPercentLabel(e.royaltyBps);
  const saludo = parrafo(e.authorName ? `Hola ${e.authorName},` : "Hola,");
  const comun = [
    imagen(e.previewUrl, e.artworkTitle),
    formatos(e),
    parrafo(
      `Por cada copia que se venda te corresponde el ${regalia} del precio de la obra (sin contar el envío). La institución te lo liquida directamente.`,
    ),
  ];
  const vence = parrafo(
    `El enlace es personal: no lo compartas. Vale hasta el ${fechaArgentina(e.expiresAt)}; si se vence, pedile uno nuevo a ${e.institution}.`,
  );

  if (e.basis === "RULES") {
    return armar(
      e.institution,
      `${e.institution}: tu obra ${obra} va a estar en nuestra tienda`,
      [
        saludo,
        parrafo(
          `Las bases de «${e.contestTitle}», el concurso en el que participaste, permiten imprimir y vender las obras. Por eso queremos contarte que vamos a ofrecer tu obra ${obra} en la tienda online de ${e.institution}.`,
        ),
        ...comun,
        parrafo(
          `Si preferís que no esté en la tienda, podés retirarla cuando quieras desde el enlace, sin dar explicaciones. Los pedidos que ya se hayan pagado se entregan igual.`,
        ),
        vence,
      ],
      { label: "Ver mi obra y mis opciones", url: e.url },
    );
  }

  return armar(
    e.institution,
    `${e.institution} quiere ofrecer tu obra ${obra} en su tienda`,
    [
      saludo,
      parrafo(
        `Nos gustaría ofrecer tu obra ${obra}, del concurso «${e.contestTitle}», en la tienda online de ${e.institution}. Las bases del concurso no lo prevén, así que antes necesitamos tu permiso.`,
      ),
      ...comun,
      parrafo(
        `Si aceptás, la obra puede publicarse y más adelante podés retirarla cuando quieras desde el mismo enlace. Si no aceptás, no se publica. En los dos casos no tenés que dar explicaciones.`,
      ),
      vence,
    ],
    { label: "Ver la obra y responder", url: e.url },
  );
}
