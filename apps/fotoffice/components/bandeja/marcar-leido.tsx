"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { marcarLeidoAction } from "@/app/actions/bandeja";

/** Al abrir el chat lo marca como leído, una sola vez, si había mensajes sin leer. */
export function MarcarLeido({ chatId, noLeidos }: { chatId: string; noLeidos: number }) {
  const router = useRouter();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current || noLeidos <= 0) return;
    hecho.current = true;
    void marcarLeidoAction(chatId)
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .catch(() => undefined);
  }, [chatId, noLeidos, router]);
  return null;
}
