"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

type SaveResult = { error: string | null; updatedAt?: string };

const CONFLICT_MARKER = "modificó el sitio mientras tanto";

/**
 * Autosave con debounce, reutilizando la MISMA concurrencia optimista que ya tenían las
 * acciones (comparar `updatedAt`) — no es un mecanismo nuevo, es la pieza que faltaba para que
 * el guardado explícito ("Guardar borrador") se vuelva automático. Cada guardado exitoso
 * actualiza la referencia de `updatedAt` para el próximo — sin esto, el segundo autosave
 * siempre chocaría con un falso conflicto de concurrencia.
 *
 * Separación deliberada (pedida explícitamente): esto solo persiste el DRAFT. Nunca crea una
 * `WebsiteVersion` — Publicar sigue siendo una acción separada y explícita.
 *
 * Conflicto real (otra sesión guardó primero): el hook se DETIENE — no sigue reintentando el
 * autosave con datos locales sobre una base que ya no es la vigente, eso sería pisar en
 * silencio. `status === "conflict"` queda así hasta que la pantalla se recargue; la UI debe
 * mostrar un banner explícito, nunca resolverlo solo.
 */
export function useDraftAutosave<T>({
  value,
  initialUpdatedAt,
  save,
  debounceMs = 1500,
  enabled,
}: {
  value: T;
  initialUpdatedAt: string;
  save: (value: T, expectedUpdatedAt: string) => Promise<SaveResult>;
  debounceMs?: number;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastKnownUpdatedAt, setLastKnownUpdatedAt] = useState(initialUpdatedAt);
  const updatedAtRef = useRef(initialUpdatedAt);
  const savedSnapshotRef = useRef(JSON.stringify(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const blockedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled || blockedRef.current) return;
    const snapshot = JSON.stringify(value);
    if (snapshot === savedSnapshotRef.current) return;

    setStatus("dirty");
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      let res: SaveResult;
      try {
        res = await save(value, updatedAtRef.current);
      } catch (err) {
        if (!mountedRef.current) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "No se pudo guardar. Reintentá en unos segundos.");
        return;
      }
      if (!mountedRef.current) return;
      if (res.error) {
        if (res.error.includes(CONFLICT_MARKER)) {
          blockedRef.current = true;
          setStatus("conflict");
        } else {
          setStatus("error");
        }
        setError(res.error);
        return;
      }
      savedSnapshotRef.current = snapshot;
      if (res.updatedAt) {
        updatedAtRef.current = res.updatedAt;
        setLastKnownUpdatedAt(res.updatedAt);
      }
      setStatus("saved");
    }, debounceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), enabled]);

  /**
   * Sincroniza la referencia de concurrencia desde afuera del ciclo save() de este hook — para
   * cuando OTRA acción (Publicar/Despublicar) también actualiza `updatedAt` de la misma fila.
   * Sin esto, el próximo autosave manda un `expectedUpdatedAt` desactualizado y el servidor lo
   * rechaza como "conflicto", aunque el cambio lo haya hecho el mismo usuario con Publicar — no
   * otra sesión. No toca `status`: si ya estaba "dirty" con una edición local sin guardar, esa
   * edición sigue pendiente de guardarse normalmente contra la nueva referencia.
   */
  function syncUpdatedAt(updatedAt: string) {
    updatedAtRef.current = updatedAt;
    setLastKnownUpdatedAt(updatedAt);
  }

  return { status, error, draftUpdatedAt: lastKnownUpdatedAt, syncUpdatedAt };
}
