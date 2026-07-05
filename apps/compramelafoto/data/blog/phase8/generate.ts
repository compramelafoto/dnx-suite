import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";
import { COMPARATIVAS_PHASE8 } from "@/data/blog/phase8/content/comparativas";
import { FUNCIONALIDADES_PHASE8 } from "@/data/blog/phase8/content/funcionalidades";
import { NEGOCIO_CASOS_PHASE8 } from "@/data/blog/phase8/content/negocio-casos";
import { REFERIDOS_DESTACADO_PHASE8 } from "@/data/blog/phase8/content/referidos-destacado";
import { REFERIDOS_PROGRAMA_PHASE8 } from "@/data/blog/phase8/content/referidos-programa";
import { ARTICULOS_COMERCIALES_2026_PHASE8 } from "@/data/blog/phase8/content/articulos-comerciales-2026";
import { CONEXION_CAMARA_PHASE8 } from "@/data/blog/phase8/content/conexion-camara";
import { CONVOCATORIAS_FOTOGRAFO_PHASE8 } from "@/data/blog/phase8/content/convocatorias-fotografos";
import { CUANTO_COBRAR_FOTOGRAFIA_PHASE8 } from "@/data/blog/phase8/content/cuanto-cobrar-fotografia";
import { DIA_DE_LA_BANDERA_PHASE8 } from "@/data/blog/phase8/content/dia-de-la-bandera";
import { VIAJES_ESTUDIANTILES_TURISMO_PHASE8 } from "@/data/blog/phase8/content/viajes-estudiantiles-turismo";
import { SEGURIDAD_ESCOLAR_PHASE8 } from "@/data/blog/phase8/content/seguridad-escolar";
import { TUTORIALES_PHASE8 } from "@/data/blog/phase8/content/tutoriales";
import type { Phase8ArticleContent } from "@/data/blog/phase8/types";

const PHASE8_CONTENT_BY_SLUG: Record<string, Phase8ArticleContent> = {
  ...TUTORIALES_PHASE8,
  ...FUNCIONALIDADES_PHASE8,
  ...COMPARATIVAS_PHASE8,
  ...NEGOCIO_CASOS_PHASE8,
  ...REFERIDOS_DESTACADO_PHASE8,
  ...REFERIDOS_PROGRAMA_PHASE8,
  ...SEGURIDAD_ESCOLAR_PHASE8,
  ...DIA_DE_LA_BANDERA_PHASE8,
  ...VIAJES_ESTUDIANTILES_TURISMO_PHASE8,
  ...ARTICULOS_COMERCIALES_2026_PHASE8,
  ...CONVOCATORIAS_FOTOGRAFO_PHASE8,
  ...CONEXION_CAMARA_PHASE8,
  ...CUANTO_COBRAR_FOTOGRAFIA_PHASE8,
};

/** Resuelve el contenido editorial Fase 8 para un borrador por slug. */
export function generatePhase8Content(draft: Phase7ArticleDraft): Phase8ArticleContent {
  const content = PHASE8_CONTENT_BY_SLUG[draft.slug];
  if (!content) {
    throw new Error(
      `No hay contenido Fase 8 para el slug "${draft.slug}". Agregalo en data/blog/phase8/content/.`
    );
  }
  return content;
}

export function listPhase8ContentSlugs(): string[] {
  return Object.keys(PHASE8_CONTENT_BY_SLUG).sort();
}
