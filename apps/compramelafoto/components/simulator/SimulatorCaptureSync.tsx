"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { COD_CAPTURE_IMAGE_EVENT, type CodCaptureImageDetail } from "@/lib/simulator/capture-events";
import { buildCaptureMetadata } from "@/lib/simulator/capture-metadata";
import { embedExifInJpegDataUrl } from "@/lib/simulator/capture-export";
import {
  fetchSimulatorCaptures,
  resetClientIdCounter,
  saveSimulatorCapture,
  serverCaptureToClientResult,
} from "@/lib/simulator/simulator-captures-api";
import type { CaptureResult } from "@/lib/simulator/camera-exposure";
import { useCallback, useEffect, useRef } from "react";

/**
 * Sincroniza sesión de auth, hidrata galería desde servidor (7 días)
 * y guarda capturas nuevas cuando el usuario está logueado.
 */
export default function SimulatorCaptureSync() {
  const { gallery, sessionUser, setSessionUser, hydrateGallery, patchCapture } = useCameraStore();
  const galleryRef = useRef(gallery);
  const hydratedRef = useRef(false);
  const savingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    galleryRef.current = gallery;
  }, [gallery]);

  useEffect(() => {
    let cancelled = false;

    const loadUserAndGallery = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          user: { id: number; email: string; name: string | null } | null;
        };
        if (cancelled) return;

        if (!data.user) {
          setSessionUser(null);
          hydratedRef.current = true;
          return;
        }

        const user = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        };
        setSessionUser(user);

        const records = await fetchSimulatorCaptures();
        if (cancelled) return;

        const serverItems = records.map((record, index) =>
          serverCaptureToClientResult(record, index + 1, user.id),
        );
        resetClientIdCounter(serverItems.length);

        const localOnly = gallery.filter((item) => !item.serverId);
        const merged = [...serverItems, ...localOnly].map((item) => ({
          ...item,
          takenBy: item.takenBy ?? user,
        }));

        if (!hydratedRef.current || serverItems.length > 0) {
          hydrateGallery(merged);
        }
        hydratedRef.current = true;
      } catch (error) {
        console.warn("[Cam Of Duty] No se pudo sincronizar capturas:", error);
        hydratedRef.current = true;
      }
    };

    void loadUserAndGallery();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidratar una vez al montar
  }, [setSessionUser, hydrateGallery]);

  const persistCapture = useCallback(
    async (photo: CaptureResult, imageUrl: string) => {
      if (!sessionUser || photo.savedToServer || photo.serverId) return;
      if (savingRef.current.has(photo.id)) return;

      savingRef.current.add(photo.id);
      try {
        const imageDataUrl = embedExifInJpegDataUrl(imageUrl, photo, sessionUser);
        const record = await saveSimulatorCapture({
          imageDataUrl,
          metadata: buildCaptureMetadata(photo),
          stars: photo.stars,
          capturedAt: photo.timestamp,
          localClientId: photo.id,
        });

        patchCapture(photo.id, {
          serverId: record.id,
          savedToServer: true,
          previewUrl: record.imageUrl,
          takenBy: sessionUser,
        });
      } catch (error) {
        console.warn("[Cam Of Duty] Error guardando captura:", error);
      } finally {
        savingRef.current.delete(photo.id);
      }
    },
    [sessionUser, patchCapture],
  );

  useEffect(() => {
    const onCaptureImage = (event: Event) => {
      const { url } = (event as CustomEvent<CodCaptureImageDetail>).detail;
      if (!sessionUser || !url) return;
      const items = galleryRef.current;
      const photo = items[items.length - 1];
      if (!photo) return;
      void persistCapture({ ...photo, previewUrl: url }, url);
    };

    window.addEventListener(COD_CAPTURE_IMAGE_EVENT, onCaptureImage);
    return () => window.removeEventListener(COD_CAPTURE_IMAGE_EVENT, onCaptureImage);
  }, [sessionUser, persistCapture]);

  return null;
}
