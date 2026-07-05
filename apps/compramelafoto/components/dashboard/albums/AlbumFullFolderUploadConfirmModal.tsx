"use client";

import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";

export type AlbumFullFolderUploadConfirmModalProps = {
  open: boolean;
  mode: "album" | "event";
  onClose: () => void;
  onConfirmPickFolder: () => void;
};

export default function AlbumFullFolderUploadConfirmModal({
  open,
  mode,
  onClose,
  onConfirmPickFolder,
}: AlbumFullFolderUploadConfirmModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Subir carpeta completa"
      size="lg"
      contentClassName="ds-modal-scroll--padded"
    >
      <div className="space-y-4">
        {mode === "album" ? (
          <>
            <p className="ds-readable-text text-sm text-[#374151] m-0 leading-relaxed">
              Se va a respetar la estructura de carpetas de tu computadora. La carpeta seleccionada
              actualmente no se usará como destino.
            </p>
            <p className="ds-readable-text text-sm text-[#374151] m-0 leading-relaxed">
              Si elegís una carpeta llamada «Ceremonia», se creará o buscará una carpeta «Ceremonia»
              dentro del álbum.
            </p>
            <p className="ds-readable-text text-sm text-[#6b7280] m-0 leading-relaxed">
              <span className="font-medium text-[#374151]">Consejo:</span> seleccioná directamente la
              carpeta que contiene las fotos o categorías finales, no una carpeta contenedora general
              innecesaria.
            </p>
          </>
        ) : (
          <>
            <p className="ds-readable-text text-sm text-[#374151] m-0 leading-relaxed">
              En este álbum colaborativo solo se aceptan carpetas ya creadas por el organizador. La
              estructura de tu computadora debe coincidir exactamente con las carpetas oficiales del
              evento.
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3">
              <p className="ds-readable-text text-sm text-[#374151] m-0 leading-relaxed">
                Si una carpeta no existe, esas fotos pueden fallar durante la subida. Pedí al
                organizador que cree la estructura antes de subir.
              </p>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-[#ebe8e4]">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="min-h-11 w-full sm:w-auto"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => {
              onClose();
              onConfirmPickFolder();
            }}
          >
            Elegir carpeta
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
