/**
 * Layout: wizards, formularios y tipografía de apoyo.
 *
 * Wizards (API integrada):
 * - `WizardLayout` — header + stepper + contenido con título de paso + footer.
 * - `WizardHeader`, `WizardStepper`, `WizardContent`, `WizardFooter` — piezas sueltas.
 * - `WizardSection` — bloques dentro de un paso.
 * - `WizardField` — un campo por control.
 *
 * Shell público / marketing: **`PublicMarketingHeader`** (logo grande, dashboard con sesión, menú dorado).
 *
 * Contenedor por slots (legacy / avanzado): `WizardFrame`.
 *
 * Formularios genéricos (no wizard): `FormSection`, `FormField`.
 */

export { WizardLayout } from "./WizardLayout";
export type { WizardLayoutProps } from "./WizardLayout";
export type { WizardStepItem } from "./WizardStepper";

export { WizardFrame } from "./WizardFrame";
export type { WizardFrameProps } from "./WizardFrame";

export { WizardHeader } from "./WizardHeader";
export type { WizardHeaderProps } from "./WizardHeader";

export { WizardStepper } from "./WizardStepper";

export { WizardContent } from "./WizardContent";
export type { WizardContentProps } from "./WizardContent";

export { WizardFooter } from "./WizardFooter";
export type { WizardFooterProps } from "./WizardFooter";

export { WizardSection } from "./WizardSection";
export type { WizardSectionProps } from "./WizardSection";

export { WizardField } from "./WizardField";
export type { WizardFieldProps } from "./WizardField";

export { FormSection } from "./FormSection";
export type { FormSectionProps } from "./FormSection";

export { FormField } from "./FormField";
export type { FormFieldProps } from "./FormField";

export { PublicMarketingHeader } from "./PublicMarketingHeader";
export type {
  PublicMarketingHeaderProps,
  PublicMarketingHeaderLinkProps,
} from "./PublicMarketingHeader";
