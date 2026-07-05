import Link from "next/link";
import {
  CC_WIZARD_MODAL_HINT,
  CC_WIZARD_MODAL_SUBTITLE,
} from "@/lib/cuantocobro/types";
import { CC_APP_PATH } from "@/lib/cuantocobro/constants";

type Props = {
  children: React.ReactNode;
};

/** Marco visual del wizard (misma estética que el modal original). */
export default function CuantoCobroWizardFrame({ children }: Props) {
  return (
    <div className="cc-wizard-frame">
      <header className="cc-wizard-frame__header">
        <nav className="cc-wizard-frame__breadcrumb" aria-label="Ubicación">
          <Link href={CC_APP_PATH} className="cc-wizard-frame__breadcrumb-link">
            Inicio
          </Link>
          <span className="cc-wizard-frame__breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="cc-wizard-frame__breadcrumb-current">Cotizar</span>
        </nav>
        <h1 className="cc-wizard-frame__title">Cotizar un trabajo</h1>
        <p className="cc-wizard-frame__subtitle m-0">{CC_WIZARD_MODAL_SUBTITLE}</p>
        <p className="cc-wizard-frame__hint m-0 mt-2">{CC_WIZARD_MODAL_HINT}</p>
      </header>
      <div className="cc-wizard-frame__body">{children}</div>
    </div>
  );
}
