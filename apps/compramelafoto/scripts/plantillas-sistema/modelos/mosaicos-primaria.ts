import type { Modelo } from "./tipo";
import { mosaicoPrimariaCuaderno } from "./58-mosaico-primaria-cuaderno";
import { mosaicoPrimariaUtiles } from "./59-mosaico-primaria-utiles";
import { mosaicoPrimariaPizarritas } from "./60-mosaico-primaria-pizarritas";
import { mosaicoPrimariaLapices } from "./61-mosaico-primaria-lapices";
import { mosaicoPrimariaFinDeAno } from "./62-mosaico-primaria-fin-de-ano";
import { mosaicoReligiosoColegioCatolico } from "./69-mosaico-religioso-colegio-catolico";
import { mosaicoReligiosoComunion } from "./70-mosaico-religioso-comunion";

/**
 * Carpetas del curso con mosaico, grupo «primaria» (ver `mosaicos.ts`): 58 a 62 de primaria y
 * las dos religiosas, 69 (colegio católico) y 70 (comunión del curso).
 */
export const MOSAICOS_PRIMARIA: Modelo[] = [
  mosaicoPrimariaCuaderno,
  mosaicoPrimariaUtiles,
  mosaicoPrimariaPizarritas,
  mosaicoPrimariaLapices,
  mosaicoPrimariaFinDeAno,
  mosaicoReligiosoColegioCatolico,
  mosaicoReligiosoComunion,
];
