import type { Modelo } from "./tipo";
import { jardinAcuarela } from "./01-jardin-acuarela";
import { jardinAnimalitos } from "./02-jardin-animalitos";
import { primariaCuaderno } from "./03-primaria-cuaderno";
import { primariaPizarron } from "./04-primaria-pizarron";
import { secundariaGeometrico } from "./05-secundaria-geometrico";
import { secundariaUrbano } from "./06-secundaria-urbano";
import { egresadosNegroDorado } from "./07-egresados-negro-dorado";
import { formalClasico } from "./08-formal-clasico";
import { kraftVintage } from "./09-kraft-vintage";
import { minimalista } from "./10-minimalista";

/** Los modelos, en el orden en que se listan. */
export const MODELOS: Modelo[] = [
  jardinAcuarela,
  jardinAnimalitos,
  primariaCuaderno,
  primariaPizarron,
  secundariaGeometrico,
  secundariaUrbano,
  egresadosNegroDorado,
  formalClasico,
  kraftVintage,
  minimalista,
];
