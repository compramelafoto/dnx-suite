import type { Modelo } from "./tipo";
import { mosaicoPrimariaPizarron } from "./51-mosaico-primaria-pizarron";
import { MOSAICOS_JARDIN } from "./mosaicos-jardin";
import { MOSAICOS_PRIMARIA } from "./mosaicos-primaria";
import { MOSAICOS_SECUNDARIA } from "./mosaicos-secundaria";
import { MOSAICOS_FIGURITAS } from "./mosaicos-figuritas";

/**
 * Modelos 51 a 70 (serie «mosaicos»): carpetas del curso con el mosaico de compañeros. Ver
 * `mosaicos-comun.ts`. Orden: 51 pizarrón, 52–57 jardín, 58–62 primaria, 63–68 secundaria y
 * egresados, 69–70 religiosas (en la lista de primaria).
 */
export const MOSAICOS: Modelo[] = [mosaicoPrimariaPizarron, ...MOSAICOS_JARDIN, ...MOSAICOS_PRIMARIA, ...MOSAICOS_SECUNDARIA, ...MOSAICOS_FIGURITAS];
