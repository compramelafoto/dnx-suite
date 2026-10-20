import type { Modelo } from "./tipo";
import { comunionClasicaDorada } from "./41-comunion-clasica-dorada";
import { comunionAcuarelaPalomas } from "./42-comunion-acuarela-palomas";
import { comunionMinimalista } from "./43-comunion-minimalista";
import { comunionPuntillasFlores } from "./44-comunion-puntillas-flores";
import { comunionCelesteEspigas } from "./45-comunion-celeste-espigas";
import { comunionHorizontalSalvia } from "./46-comunion-horizontal-salvia";
import { confirmacionPalomaLlamas } from "./47-confirmacion-paloma-llamas";
import { confirmacionVitral } from "./48-confirmacion-vitral";
import { bautismoAcuarelaCeleste } from "./49-bautismo-acuarela-celeste";
import { misaFinDeAnioHorizontal } from "./50-misa-fin-de-anio-horizontal";

/**
 * Modelos 41 a 50 (serie «religiosas»): actos religiosos de colegios. Primera Comunión (seis,
 * uno apaisado), Confirmación (dos), Bautismo y misa de fin de año (apaisada). Se generan con
 * `generar.ts --serie=religiosas`.
 */
export const RELIGIOSOS: Modelo[] = [
  comunionClasicaDorada,
  comunionAcuarelaPalomas,
  comunionMinimalista,
  comunionPuntillasFlores,
  comunionCelesteEspigas,
  comunionHorizontalSalvia,
  confirmacionPalomaLlamas,
  confirmacionVitral,
  bautismoAcuarelaCeleste,
  misaFinDeAnioHorizontal,
];
