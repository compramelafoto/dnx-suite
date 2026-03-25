"use client";

import Link from "next/link";
import { compositionSpacing } from "@repo/design-system";
import { Modal } from "../ui/Modal";

type LoginChoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Pregunta el tipo de usuario antes de ir al login correspondiente.
 * Atajo: Shift+clic en el icono del header va directo a /login (admin).
 */
export function LoginChoiceModal({ isOpen, onClose }: LoginChoiceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="¿Cómo querés ingresar?"
      maxWidth="md"
      header="full"
      centeredHeader
      showTopLogo={false}
    >
      <div>
        <p className="mx-auto max-w-lg text-balance text-center font-sans text-xl font-medium leading-snug text-fr-muted md:text-2xl md:leading-relaxed">
          Elegí tu perfil para ir al formulario de acceso correcto.
        </p>
        <div
          className="flex flex-col sm:flex-row sm:justify-center"
          style={{
            marginTop: compositionSpacing.stack.contentToActions,
            gap: compositionSpacing.horizontal.actionGapComfort,
          }}
        >
          <Link
            href="/login"
            onClick={onClose}
            className="fr-btn fr-btn-primary min-w-[10rem] flex-1 justify-center px-8 py-4 text-center sm:flex-initial"
          >
            Organizador
          </Link>
          <Link
            href="/jurado/login"
            onClick={onClose}
            className="fr-btn fr-btn-secondary min-w-[10rem] flex-1 justify-center px-8 py-4 text-center sm:flex-initial"
          >
            Jurado
          </Link>
        </div>
      </div>
    </Modal>
  );
}
