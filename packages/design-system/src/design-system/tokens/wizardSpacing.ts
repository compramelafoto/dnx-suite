/**
 * Espaciado semántico para wizards (Fotorank / plataforma).
 * Deriva de `spacing` y de `compositionSpacing.form` donde aplica (label/control/helper).
 *
 * Reglas:
 * - header → stepper: amplio
 * - stepper → título del paso: amplio
 * - título → descripción: medio
 * - descripción → primer bloque: amplio
 * - entre WizardSection: amplio
 * - entre WizardField: medio
 */

import { spacing } from "./spacing";
import { compositionSpacing } from "./compositionSpacing";

export const wizardSpacing = {
  headerPadding: spacing[6],
  /** Espacio visual entre header y barra de pasos */
  headerToStepper: spacing[8],
  stepperPaddingY: spacing[6],
  stepperPaddingX: spacing[6],
  /** Stepper → título principal del paso */
  stepperToStepTitle: spacing[8],
  /** Título del paso → descripción */
  stepTitleToDescription: spacing[3],
  /** Descripción → primer bloque de contenido */
  descriptionToFirstBlock: spacing[8],
  /** Entre bloques WizardSection consecutivos */
  betweenSections: spacing[8],
  /** Entre WizardField dentro de una sección */
  betweenFields: compositionSpacing.form.betweenFields,
  labelToInput: compositionSpacing.form.labelToControl,
  inputToHelper: compositionSpacing.form.controlToHelper,
  footerPadding: spacing[6],
  contentPaddingX: spacing[6],
  contentPaddingY: spacing[6],
} as const;

export type WizardSpacing = typeof wizardSpacing;
