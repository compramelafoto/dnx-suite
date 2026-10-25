import type { Modelo } from "./tipo";
import { jardinApaisadoArcoiris } from "./21-jardin-apaisado-arcoiris";
import { jardinCrayonesAmigos } from "./22-jardin-crayones-amigos";
import { primariaCollagePolaroids } from "./23-primaria-collage-polaroids";
import { primariaApaisadoExplorador } from "./24-primaria-apaisado-explorador";
import { secundariaRevista } from "./25-secundaria-revista";
import { secundariaApaisadoNeon } from "./26-secundaria-apaisado-neon";
import { egresadosApaisadoPasaje } from "./27-egresados-apaisado-pasaje";
import { egresadosMinimalASangre } from "./28-egresados-minimal-a-sangre";
import { jardinApaisadoGranja } from "./29-jardin-apaisado-granja";
import { primariaMejoresAmigos } from "./30-primaria-mejores-amigos";
import { clasicoApaisadoDorado } from "./31-clasico-apaisado-dorado";
import { religiosoPrimeraComunion } from "./32-religioso-primera-comunion";
import { minimalApaisado } from "./33-minimal-apaisado";
import { secundariaGrillaCollage } from "./34-secundaria-grilla-collage";
import { jardinPastelASangre } from "./35-jardin-pastel-a-sangre";
import { primariaHistorieta } from "./36-primaria-historieta";
import { egresadosApaisadoCorcho } from "./37-egresados-apaisado-corcho";
import { secundariaSinListadoAmigos } from "./38-secundaria-sin-listado-amigos";
import { primariaFinDeAnoConfeti } from "./39-primaria-fin-de-ano-confeti";
import { egresadosDiploma } from "./40-egresados-diploma";

/**
 * Modelos 21 a 40 (serie «variadas»): más variedad de estructura. Hay apaisados (se leen de
 * costado, ver `apaisado.ts`), libritos sin listado, fotos a sangre en tapa y contratapa, collages
 * de 4 o 5 fotos y otras fotos además de individual y grupal (con la maestra, con amigos, libre).
 */
export const VARIADAS: Modelo[] = [
  jardinApaisadoArcoiris,
  jardinCrayonesAmigos,
  primariaCollagePolaroids,
  primariaApaisadoExplorador,
  secundariaRevista,
  secundariaApaisadoNeon,
  egresadosApaisadoPasaje,
  egresadosMinimalASangre,
  jardinApaisadoGranja,
  primariaMejoresAmigos,
  clasicoApaisadoDorado,
  religiosoPrimeraComunion,
  minimalApaisado,
  secundariaGrillaCollage,
  jardinPastelASangre,
  primariaHistorieta,
  egresadosApaisadoCorcho,
  secundariaSinListadoAmigos,
  primariaFinDeAnoConfeti,
  egresadosDiploma,
];
