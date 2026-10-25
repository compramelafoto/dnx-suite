"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { marcarLeidoAction } from "@/app/actions/bandeja";

/**
 * Marca el chat como leído al abrirlo y de nuevo cada vez que llegan mensajes mientras está abierto
 * (`noLeidos` sube). Nunca hay dos llamadas a la vez: si llegó un mensaje durante una llamada, se
 * repite al terminar. Si la acción falla no se reintenta sola.
 */
export function MarcarLeido({ chatId, noLeidos }: { chatId: string; noLeidos: number }) {
  const router = useRouter();
  const enCurso = useRef(false);
  const ultimoValor = useRef(noLeidos);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    ultimoValor.current = noLeidos;
    if (noLeidos <= 0 || enCurso.current) return;
    enCurso.current = true;
    const marcado = noLeidos;
    void marcarLeidoAction(chatId)
      .then((r) => {
        if (r.ok) router.refresh();
        return r.ok;
      })
      .catch(() => false)
      .then((ok) => {
        enCurso.current = false;
        // Llegó algo mientras se marcaba: una vuelta más.
        if (ok && ultimoValor.current > 0 && ultimoValor.current !== marcado) setVuelta((v) => v + 1);
      });
  }, [chatId, noLeidos, vuelta, router]);
  return null;
}
