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
import { formalAzulMarino } from "./11-formal-azul-marino";
import { formalVerdeIngles } from "./12-formal-verde-ingles";
import { formalBordoCuero } from "./13-formal-bordo-cuero";
import { egresadosGrafito } from "./14-egresados-grafito";
import { formalBlancoPlata } from "./15-formal-blanco-plata";
import { formalMarmol } from "./16-formal-marmol";
import { actoVerjurado } from "./17-acto-verjurado";
import { egresadosAzulOro } from "./18-egresados-azul-oro";
import { formalHeraldico } from "./19-formal-heraldico";
import { institucionalBanda } from "./20-institucional-banda";
import { VARIADAS } from "./variadas";
import { RELIGIOSOS } from "./religiosos";
import { MOSAICOS } from "./mosaicos";

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
  formalAzulMarino,
  formalVerdeIngles,
  formalBordoCuero,
  egresadosGrafito,
  formalBlancoPlata,
  formalMarmol,
  actoVerjurado,
  egresadosAzulOro,
  formalHeraldico,
  institucionalBanda,
  ...VARIADAS,
  ...RELIGIOSOS,
  ...MOSAICOS,
];
