"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  combinarNotas,
  guardarNotasLocales,
  leerNotasLocales,
  type NotasLocales,
} from "@/lib/participant-notes/local-store";

/**
 * Anotaciones del participante, escritas primero en el teléfono.
 *
 * Guarda en el dispositivo al instante y manda al servidor 700 ms después de
 * que la persona deja de teclear. Si no hay señal, la nota queda en cola y se
 * reintenta cuando vuelve la conexión o cuando la pestaña vuelve al frente.
 */

export type EstadoGuardado = "limpio" | "guardando" | "guardado" | "pendiente" | "cerrado";

const ESPERA_MS = 700;

export function useParticipantNotes(registrationId: string, editable: boolean) {
  const [notas, setNotas] = useState<NotasLocales>({});
  const [estado, setEstado] = useState<EstadoGuardado>("limpio");
  const temporizadores = useRef<Map<string, number>>(new Map());
  const enCola = useRef<Set<string>>(new Set());
  const notasRef = useRef<NotasLocales>({});

  const persistirLocal = useCallback(
    (siguiente: NotasLocales) => {
      notasRef.current = siguiente;
      setNotas(siguiente);
      guardarNotasLocales(registrationId, siguiente);
    },
    [registrationId],
  );

  const sincronizar = useCallback(
    async (promptId: string) => {
      const nota = notasRef.current[promptId];
      if (!nota) return;
      try {
        const res = await fetch(
          `/api/account/registrations/${registrationId}/notes/${promptId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              body: nota.body,
              solved: nota.solved,
              clientUpdatedAt: nota.clientUpdatedAt,
            }),
          },
        );
        if (res.status === 409) {
          setEstado("cerrado");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));

        enCola.current.delete(promptId);
        persistirLocal({
          ...notasRef.current,
          [promptId]: { ...notasRef.current[promptId]!, pending: false },
        });
        setEstado(enCola.current.size > 0 ? "pendiente" : "guardado");
      } catch {
        enCola.current.add(promptId);
        setEstado("pendiente");
      }
    },
    [persistirLocal, registrationId],
  );

  // Hidratar: primero el dispositivo (instantáneo), después el servidor.
  useEffect(() => {
    const local = leerNotasLocales(registrationId);
    notasRef.current = local;
    setNotas(local);
    for (const [promptId, nota] of Object.entries(local)) {
      if (nota.pending) enCola.current.add(promptId);
    }

    let cancelado = false;
    void (async () => {
      try {
        const res = await fetch(`/api/account/registrations/${registrationId}/notes`, {
          cache: "no-store",
        });
        if (!res.ok || cancelado) return;
        const json = (await res.json()) as {
          notes?: Array<{ promptId: string; body: string; solved: boolean }>;
        };
        if (cancelado) return;
        persistirLocal(
          combinarNotas({
            delServidor: json.notes ?? [],
            delDispositivo: notasRef.current,
          }),
        );
      } catch {
        /* sin señal al abrir: queda lo del dispositivo */
      }
      for (const promptId of enCola.current) void sincronizar(promptId);
    })();

    return () => {
      cancelado = true;
    };
  }, [persistirLocal, registrationId, sincronizar]);

  // Reintentar lo pendiente cuando vuelve la señal o la pestaña.
  useEffect(() => {
    if (!editable) return;
    const reintentar = () => {
      for (const promptId of enCola.current) void sincronizar(promptId);
    };
    window.addEventListener("online", reintentar);
    document.addEventListener("visibilitychange", reintentar);
    return () => {
      window.removeEventListener("online", reintentar);
      document.removeEventListener("visibilitychange", reintentar);
    };
  }, [editable, sincronizar]);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      pendientes.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const escribir = useCallback(
    (promptId: string, cambio: { body?: string; solved?: boolean }) => {
      if (!editable) return;
      const previa = notasRef.current[promptId];
      const siguiente: NotasLocales = {
        ...notasRef.current,
        [promptId]: {
          promptId,
          body: cambio.body ?? previa?.body ?? "",
          solved: cambio.solved ?? previa?.solved ?? false,
          clientUpdatedAt: new Date().toISOString(),
          pending: true,
        },
      };
      persistirLocal(siguiente);
      setEstado("guardando");

      const anterior = temporizadores.current.get(promptId);
      if (anterior) window.clearTimeout(anterior);
      temporizadores.current.set(
        promptId,
        window.setTimeout(() => void sincronizar(promptId), ESPERA_MS),
      );
    },
    [editable, persistirLocal, sincronizar],
  );

  return { notas, estado, escribir };
}
