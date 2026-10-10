import { EXHIBITOR_TEXT_LIMITS, type ExhibitorWorkData } from "@repo/muestras";
import { esImagenDeUsuario } from "@/lib/envios/mapear";

export type ObraDelFormulario = {
  /** Vacío = obra nueva. */
  id: string | null;
  datos: ExhibitorWorkData;
  /** Llegó una imagen que no subió esta persona por nuestra ruta: se descartó. */
  imagenAjena: boolean;
};

const texto = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max).trim();

/** Vacío = `null`. Lo que no es un número queda `NaN` para que la regla diga qué revisar. */
function numero(fd: FormData, k: string, leer: (s: string) => number): number | null {
  const s = String(fd.get(k) ?? "").trim();
  if (!s) return null;
  return leer(s);
}

/** "40,5" o "40.5" → 40,5 cm. */
const centimetros = (s: string) => (/^\d{1,4}(?:[.,]\d{1,2})?$/.test(s) ? Number(s.replace(",", ".")) : Number.NaN);
/** Año de cuatro cifras. */
const anio = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : Number.NaN);
const entero = (s: string) => (/^\d{1,4}$/.test(s) ? Number(s) : Number.NaN);
/** Pesos sin centavos: "120.000", "$ 120 000" o "120000" → 120000. Con centavos, `NaN`. */
const pesos = (s: string) => {
  const limpio = s.replace(/^\$\s*/, "").replace(/[.\s]/g, "");
  return /^\d{1,12}$/.test(limpio) ? Number(limpio) : Number.NaN;
};

/**
 * Una obra del expositor desde el formulario de "Donde expongo" (spec D5). La foto sólo cuenta si
 * la subió esta misma persona por nuestra ruta (`<R2>/muestras/<userId>/<id>.webp`).
 */
export function obraDesdeFormData(fd: FormData, base: string | null, userId: number): ObraDelFormulario {
  const idCrudo = String(fd.get("id") ?? "").trim();
  const id = /^[A-Za-z0-9_-]{1,64}$/.test(idCrudo) ? idCrudo : null;
  const url = String(fd.get("imageUrl") ?? "").trim();
  const propia = !!url && esImagenDeUsuario(url, base, userId);
  const edition = texto(fd, "edition", 20) || null;
  const limitada = edition === "LIMITED";
  const forSale = fd.get("forSale") === "1" || fd.get("forSale") === "on";
  return {
    id,
    imagenAjena: !!url && !propia,
    datos: {
      imageUrl: propia ? url : null,
      title: texto(fd, "title", EXHIBITOR_TEXT_LIMITS.title),
      year: numero(fd, "year", anio),
      technique: texto(fd, "technique", EXHIBITOR_TEXT_LIMITS.technique) || null,
      imageWidthCm: numero(fd, "imageWidthCm", centimetros),
      imageHeightCm: numero(fd, "imageHeightCm", centimetros),
      frameWidthCm: numero(fd, "frameWidthCm", centimetros),
      frameHeightCm: numero(fd, "frameHeightCm", centimetros),
      edition,
      editionNumber: limitada ? numero(fd, "editionNumber", entero) : null,
      editionSize: limitada ? numero(fd, "editionSize", entero) : null,
      statement: texto(fd, "statement", EXHIBITOR_TEXT_LIMITS.statement) || null,
      forSale,
      // Sin "La quiero vender" no se guarda precio: nadie lo pidió.
      priceArs: forSale ? numero(fd, "priceArs", pesos) : null,
      hangingNotes: texto(fd, "hangingNotes", EXHIBITOR_TEXT_LIMITS.hangingNotes) || null,
    },
  };
}

const RESUMEN: ReadonlyArray<[string, string, string]> = [
  ["APPROVED", "en la muestra", "en la muestra"],
  ["SUBMITTED", "enviada", "enviadas"],
  ["CHANGES_REQUESTED", "con cambios pedidos", "con cambios pedidos"],
  ["DRAFT", "en borrador", "en borrador"],
  ["REMOVED", "fuera de la muestra", "fuera de la muestra"],
];

/** "3 obras: 1 en la muestra, 1 enviada, 1 con cambios pedidos". Sin obras: "Todavía no cargaste obras". */
export function resumenDeObras(obras: ReadonlyArray<{ status: string }>): string {
  if (!obras.length) return "Todavía no cargaste obras";
  const partes = RESUMEN.flatMap(([st, uno, varios]) => {
    const n = obras.filter((o) => o.status === st).length;
    return n ? [`${n} ${n === 1 ? uno : varios}`] : [];
  });
  return `${obras.length} ${obras.length === 1 ? "obra" : "obras"}: ${partes.join(", ")}`;
}
