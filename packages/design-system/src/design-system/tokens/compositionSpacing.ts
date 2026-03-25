/**
 * Espaciado semántico de composición (layout, jerarquía, modales, formularios).
 *
 * Todos los valores derivan de `spacing` (base 4px/8px). No duplicar números sueltos
 * en pantallas: importar `compositionSpacing` o las utilidades CSS del tema (FotoRank: `--fr-comp-*`).
 *
 * @see design_rule.mdc (FotoRank) — debe mantenerse alineado conceptualmente.
 * @see appShellHeader — top bars / headers de 3 zonas (FotoRank).
 */

import { spacing } from "./spacing";

export const compositionSpacing = {
  /** Apilamiento vertical general (páginas, columnas, intro de modal) */
  stack: {
    /** Metadato / icono pequeño → línea siguiente */
    tight: spacing[2],
    /** Título → subtítulo o descripción corta */
    titleToSubtitle: spacing[4],
    /** Subtítulo / lead → contenido (lista, campos, párrafo) */
    subtitleToContent: spacing[6],
    /** Entre bloques relacionados en la misma vista */
    block: spacing[8],
    /** Entre secciones mayores de página */
    section: spacing[12],
    /** Último bloque de contenido → barra de acciones (footer modal, wizard) */
    contentToActions: spacing[16],
  },

  /** Ritmo horizontal */
  horizontal: {
    /** Icono → texto en línea */
    iconToText: spacing[2],
    /** Botón → botón (grupo compacto) */
    actionGap: spacing[3],
    /** Botón → botón (respiración cómoda) o chips */
    actionGapComfort: spacing[4],
    /** Gap entre cards en grid */
    cardGap: spacing[8],
    /** Gap entre columnas en layout de dos paneles */
    columnGap: spacing[6],
  },

  /** Superficie modal (overlay + panel) */
  modal: {
    paddingOverlay: spacing[8],
    headerPaddingX: spacing[8],
    headerPaddingY: spacing[5],
    /**
     * Separación entre el bloque de título (columna flexible) y la zona del botón cerrar.
     * Evita que el texto compita con la X; el título usa `min-width: 0` y puede hacer wrap.
     */
    titleToCloseGap: spacing[6],
    /** Área clickeable mínima del cerrar (~44×44px, WCAG 2.5.5 / práctica táctil) */
    closeHitArea: "44px",
    /** Tamaño del icono / glifo dentro del botón cerrar */
    closeGlyphSize: "20px",
    /** Altura mínima de la fila del header: padding vertical + hit area centrada (20+44+20 px) */
    headerMinHeight: "5.25rem",
    bodyPadding: spacing[8],
    /** Desktop: cuerpo modal más aireado (p-10) */
    bodyPaddingMd: spacing[10],
    footerPaddingX: spacing[8],
    footerPaddingY: spacing[6],
    footerActionGap: spacing[4],
  },

  /**
   * Marca dentro del panel modal (isologo / wordmark pequeño).
   * Solo onboarding, bienvenida o piezas de marca; no en modales funcionales (login, decisión, formularios).
   * Orden visual obligatorio: logo → título → descripción → acciones (nunca logo entre título y cuerpo).
   */
  modalBrand: {
    insetPaddingTop: spacing[6],
    logoToTitle: spacing[4],
    titleToSubtitle: spacing[4],
    subtitleToActions: spacing[8],
    logoMaxHeight: "48px",
    logoMinHeight: "32px",
  },

  /** Formularios (no wizard exclusivo: modales dashboard, settings) */
  form: {
    /** Label → control (aire visual profesional: evita texto pegado al recuadro) */
    labelToControl: spacing[8],
    /** Control → helper / error */
    controlToHelper: spacing[3],
    /** Entre campos completos en formulario denso */
    betweenFields: spacing[6],
    /** Entre grupos / FormSection */
    betweenSections: spacing[12],
    /** Título de sección → borde superior del recuadro de campos */
    sectionTitleToFields: spacing[4],
  },

  /**
   * Alias documental de `modalBrand` para intros de diálogo (mismos valores).
   * El componente `DialogIntro` usa `modalBrand` en implementación.
   */
  dialogIntro: {
    brandToTitle: spacing[4],
    titleToSubtitle: spacing[4],
    subtitleToChildren: spacing[8],
  },

  /** Superficies genéricas (card, panel) — mismo valor numérico que modal body en la mayoría de temas */
  surface: {
    cardPadding: spacing[8],
  },

  /**
   * Fichas de directorios ComprameLaFoto (grid de fotógrafos / laboratorios).
   * Ritmo vertical: título → metadatos → redes → CTA, con separación clara entre bloques.
   */
  comprameLaFotoDirectory: {
    /** Entre tarjetas en la grilla (usa `gap-8` / 32px) */
    gridGap: spacing[8],
    /** Padding horizontal del cuerpo bajo el logo */
    cardBodyPaddingX: spacing[6],
    cardBodyPaddingTop: spacing[5],
    cardBodyPaddingBottom: spacing[6],
    /** Título → bloque de líneas (ciudad, tel., etc.) */
    titleToMeta: spacing[4],
    /** Entre líneas de metadatos relacionadas */
    metaLineGap: spacing[3],
    /** Bloque de metadatos → fila de iconos sociales */
    metaToSocial: spacing[6],
    /** Gap entre iconos de redes */
    socialIconGap: spacing[3],
    /** Fila social → borde superior del CTA “Ver perfil” */
    socialToCta: spacing[6],
    /** Padding superior sobre el enlace CTA (tras el divider) */
    ctaPaddingTop: spacing[5],
  },

  /**
   * Dashboard operativo ComprameLaFoto: separación entre bloques de cards.
   * Evita el efecto de tarjetas "pegadas".
   */
  comprameLaFotoDashboard: {
    /** Card/listado principal → bloque KPI */
    cardsBlockToKpi: spacing[8],
    /** KPI ↔ KPI en grilla */
    kpiGridGap: spacing[8],
  },
} as const;

export type CompositionSpacing = typeof compositionSpacing;
