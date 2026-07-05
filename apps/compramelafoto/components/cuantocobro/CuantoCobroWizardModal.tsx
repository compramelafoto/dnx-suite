"use client";

import CuantoCobroWizard from "@/components/cuantocobro/CuantoCobroWizard";
import AppModal from "@/components/ui/AppModal";
import { CC_WIZARD_MODAL_HINT, CC_WIZARD_MODAL_SUBTITLE } from "@/lib/cuantocobro/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CuantoCobroWizardModal({ open, onClose }: Props) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      maxWidthCapRem="72rem"
      title="¿Cuánto Cobro?"
      description={
        <>
          <p className="m-0">{CC_WIZARD_MODAL_SUBTITLE}</p>
          <p className="cc-wizard-modal__hint m-0 mt-2">{CC_WIZARD_MODAL_HINT}</p>
        </>
      }
      panelClassName="cc-wizard-modal cc-page"
      contentClassName="!p-0 overflow-hidden"
      zIndexClass="z-[90]"
    >
      <CuantoCobroWizard />
    </AppModal>
  );
}
