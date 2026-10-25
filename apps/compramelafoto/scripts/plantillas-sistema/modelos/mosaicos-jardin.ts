import type { Modelo } from "./tipo";
import { mosaicoJardinBosque } from "./52-mosaico-jardin-bosque";
import { mosaicoJardinArcoiris } from "./53-mosaico-jardin-arcoiris";
import { mosaicoJardinGlobos } from "./54-mosaico-jardin-globos";
import { mosaicoJardinCrayones } from "./55-mosaico-jardin-crayones";
import { mosaicoJardinMarino } from "./56-mosaico-jardin-marino";
import { mosaicoJardinEspacio } from "./57-mosaico-jardin-espacio";

/** Carpetas del curso con mosaico, grupo «jardin» (ver `mosaicos.ts`). */
export const MOSAICOS_JARDIN: Modelo[] = [
  mosaicoJardinBosque,
  mosaicoJardinArcoiris,
  mosaicoJardinGlobos,
  mosaicoJardinCrayones,
  mosaicoJardinMarino,
  mosaicoJardinEspacio,
];
