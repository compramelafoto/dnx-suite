/**
 * Patrones de composición: secciones, intros de diálogo, grupos de acciones, estados vacíos.
 * Combinan tokens (`compositionSpacing`) + tipografía para ritmo consistente.
 */

export * from "../layout/index";
export * from "../typography/index";

export { SectionTitle } from "./SectionTitle";
export type { SectionTitleProps } from "./SectionTitle";

export { ActionGroup } from "./ActionGroup";
export type { ActionGroupProps } from "./ActionGroup";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { DialogIntro } from "./DialogIntro";
export type { DialogIntroProps } from "./DialogIntro";
