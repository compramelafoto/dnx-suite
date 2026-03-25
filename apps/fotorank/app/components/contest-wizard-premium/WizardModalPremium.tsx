"use client";

import { Modal, ModalBody } from "@repo/design-system";

export interface WizardModalPremiumProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shell mínimo del wizard de alta: sólo contenedor modal.
 * Header/stepper/footer viven en `WizardLayout` para mantener la base reusable del design system.
 */
export function WizardModalPremium({ isOpen, onClose, children }: WizardModalPremiumProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      maxWidth="min(92vw, 880px)"
      maxHeight="min(92vh, 900px)"
      zIndex={100}
      aria-labelledby="create-contest-wizard-headline"
    >
      <ModalBody style={{ padding: 0 }} className="min-h-0">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "min(88vh, 820px)",
            maxHeight: "90vh",
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </ModalBody>
    </Modal>
  );
}
