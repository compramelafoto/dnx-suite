import type { Modelo } from "./tipo";
import { mosaicoSecundariaMinimalBlanco } from "./63-mosaico-secundaria-minimal-blanco";
import { mosaicoEgresadosNegroDorado } from "./64-mosaico-egresados-negro-dorado";
import { mosaicoEgresadosRevista } from "./65-mosaico-egresados-revista";
import { mosaicoSecundariaGeometricoAzul } from "./66-mosaico-secundaria-geometrico-azul";
import { mosaicoEgresadosOrlaClasica } from "./67-mosaico-egresados-orla-clasica";
import { mosaicoSecundariaRedes } from "./68-mosaico-secundaria-redes";

/** Carpetas del curso con mosaico, grupo «secundaria» (ver `mosaicos.ts`). */
export const MOSAICOS_SECUNDARIA: Modelo[] = [
  mosaicoSecundariaMinimalBlanco,
  mosaicoEgresadosNegroDorado,
  mosaicoEgresadosRevista,
  mosaicoSecundariaGeometricoAzul,
  mosaicoEgresadosOrlaClasica,
  mosaicoSecundariaRedes,
];
