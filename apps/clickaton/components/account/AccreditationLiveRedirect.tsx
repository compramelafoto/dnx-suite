"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  participantLivePath,
  participantLiveStatusPath,
} from "@/lib/participant-live/routes";

/**
 * Lleva al participante a la pantalla de consignas apenas el equipo escanea su QR.
 *
 * La acreditación la confirma otra persona desde el panel, así que este teléfono
 * pregunta cada pocos segundos si ya quedó registrada. Solo redirige una vez por
 * sesión del navegador: después la persona puede volver a su credencial y quedarse
 * ahí sin que la pantalla se le escape.
 */

type Props = {
  registrationId: string;
  /** Estado al renderizar en el servidor: evita un salto si ya estaba acreditado. */
  alreadyAccredited: boolean;
  intervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 5000;

export function AccreditationLiveRedirect({
  registrationId,
  alreadyAccredited,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  const router = useRouter();
  const doneRef = useRef(false);

  useEffect(() => {
    const storageKey = `ck-live-redirect:${registrationId}`;
    const target = participantLivePath(registrationId);

    function yaRedirigido(): boolean {
      try {
        return window.sessionStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    }

    function irALasConsignas() {
      if (doneRef.current) return;
      doneRef.current = true;
      try {
        window.sessionStorage.setItem(storageKey, "1");
      } catch {
        /* modo privado sin almacenamiento: se redirige igual, una sola vez por carga */
      }
      router.replace(target);
    }

    if (yaRedirigido()) return;
    if (alreadyAccredited) {
      irALasConsignas();
      return;
    }

    let cancelled = false;

    async function consultar() {
      if (cancelled || doneRef.current) return;
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(participantLiveStatusPath(registrationId), {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { accredited?: boolean };
        if (json.accredited) irALasConsignas();
      } catch {
        /* sin señal: se reintenta en el próximo ciclo */
      }
    }

    void consultar();
    const id = window.setInterval(() => void consultar(), intervalMs);
    document.addEventListener("visibilitychange", consultar);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [alreadyAccredited, intervalMs, registrationId, router]);

  return null;
}
