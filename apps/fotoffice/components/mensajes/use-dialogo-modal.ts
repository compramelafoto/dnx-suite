import { useEffect, useRef } from "react";

/**
 * Un `<dialog>` modal que sigue al estado `abierto`: lo abre con `showModal()` y lo cierra con
 * `close()`. Lo usan el compositor de «Mensaje» y el de «Pedir testimonio».
 */
export function useDialogoModal(abierto: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);
  return ref;
}
