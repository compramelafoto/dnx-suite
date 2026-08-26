"use client";

import AppModal from "./primitives/AppModal";
import Button from "./primitives/Button";

type Props = {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onExitWithoutSave: () => void;
  onSaveAndExit: () => void | Promise<void>;
};

export function TemplateEditorExitModal({ open, saving, onCancel, onExitWithoutSave, onSaveAndExit }: Props) {
  return (
    <AppModal
      open={open}
      onClose={saving ? () => {} : onCancel}
      size="lg"
      title="¿Salir del editor?"
      titleId="template-editor-exit-title"
      description={
        <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
          Hay cambios sin guardar. Podés guardarlos antes de volver al listado, o salir y descartarlos.
        </p>
      }
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      zIndexClass="z-[210]"
      panelClassName="overflow-visible"
    >
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
            Seguir editando
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onExitWithoutSave} disabled={saving}>
            Salir sin guardar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void onSaveAndExit()}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar y salir"}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
