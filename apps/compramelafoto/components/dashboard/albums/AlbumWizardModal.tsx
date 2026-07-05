"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppModal from "@/components/ui/AppModal";
import AlbumWizard from "@/components/dashboard/albums/AlbumWizard";

/**
 * Ventana flotante del asistente de creación de álbum.
 * Se cierra con Esc o el botón X (no se cierra clicando el fondo).
 */
export default function AlbumWizardModal() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const dismiss = useCallback(() => {
    router.push("/dashboard/albums");
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return (
    <AppModal
      open
      onClose={dismiss}
      size="xl"
      closeOnBackdrop={false}
      title="Crear álbum con asistente"
      description="Podés cerrar con la tecla Esc o la X."
      titleId="album-wizard-modal-title"
      zIndexClass="z-[10060]"
      panelClassName="overflow-hidden border-[#e8e4df] p-0 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
    >
      <div className="box-border w-full min-w-0 max-w-full max-h-[min(78vh,calc(100vh-8rem))] overflow-y-auto px-3 pb-8 pt-4 sm:px-5">
        <AlbumWizard variant="floating" />
      </div>
    </AppModal>
  );
}
