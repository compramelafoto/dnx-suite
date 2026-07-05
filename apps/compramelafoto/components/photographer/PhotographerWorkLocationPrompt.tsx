"use client";

import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";

export type PhotographerWorkLocationPromptVariant = "clf" | "cuantocobro";

type Props = {
  open: boolean;
  variant: PhotographerWorkLocationPromptVariant;
  onAccept: () => void;
  onDismiss: () => void;
};

export default function PhotographerWorkLocationPrompt({
  open,
  variant,
  onAccept,
  onDismiss,
}: Props) {
  const accentColor = variant === "cuantocobro" ? "var(--cc-color-primary)" : undefined;

  return (
    <AppModal
      open={open}
      onClose={onDismiss}
      size="lg"
      maxWidthCapRem="44rem"
      title="Configurá tu ubicación de trabajo"
      closeOnBackdrop={false}
      showCloseButton={false}
      zIndexClass="z-[90]"
      contentClassName="ds-modal-scroll--padded"
    >
      <p className="m-0 w-full max-w-none text-sm leading-relaxed text-[#4b5563] sm:text-base">
        Para que ComprameLaFoto pueda invitarte a los próximos eventos que los organizadores carguen
        cerca de vos, necesitás configurar tu ubicación de trabajo en tu perfil.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="md"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={onDismiss}
        >
          Ahora no
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="min-h-[44px] w-full sm:w-auto"
          accentColor={accentColor}
          onClick={onAccept}
        >
          Aceptar
        </Button>
      </div>
    </AppModal>
  );
}
