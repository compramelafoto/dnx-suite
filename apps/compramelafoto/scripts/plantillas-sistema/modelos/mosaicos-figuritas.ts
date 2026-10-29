import type { Modelo } from "./tipo";
import { figuritasMundial } from "./71-figuritas-mundial";
import { figuritasInfantil } from "./72-figuritas-infantil";
import { figuritasEspacio } from "./73-figuritas-espacio";
import { figuritasEgresados } from "./74-figuritas-egresados";

/** Modelos 71 a 74: álbumes de figuritas del curso (álbum + plancha para recortar). 73 y 74 son la serie «figuritas». */
export const MOSAICOS_FIGURITAS: Modelo[] = [figuritasMundial, figuritasInfantil, figuritasEspacio, figuritasEgresados];
