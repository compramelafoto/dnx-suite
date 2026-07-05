"use client";

import PhotographerWorkLocationPrompt, {
  type PhotographerWorkLocationPromptVariant,
} from "@/components/photographer/PhotographerWorkLocationPrompt";
import {
  dismissWorkLocationPrompt,
  isWorkLocationPromptDismissed,
} from "@/lib/photographer/work-location-prompt";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  variant: PhotographerWorkLocationPromptVariant;
  /** CC: abre el modal de perfil comercial con la sección de dirección resaltada. */
  onOpenBusinessProfile?: () => void;
};

export default function PhotographerWorkLocationPromptGate({
  variant,
  onOpenBusinessProfile,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const shouldSkipPath =
    variant === "clf" && pathname != null && pathname.startsWith("/fotografo/configuracion");

  const checkStatus = useCallback(async () => {
    if (shouldSkipPath || isWorkLocationPromptDismissed()) {
      setOpen(false);
      setChecked(true);
      return;
    }

    try {
      const res = await fetch("/api/fotografo/work-location-status", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setOpen(false);
        return;
      }
      const data = (await res.json()) as { hasWorkLocation?: boolean };
      setOpen(data.hasWorkLocation === false);
    } catch {
      setOpen(false);
    } finally {
      setChecked(true);
    }
  }, [shouldSkipPath]);

  useEffect(() => {
    setChecked(false);
    void checkStatus();
  }, [checkStatus, pathname]);

  useEffect(() => {
    const onProfileUpdated = () => {
      void checkStatus();
    };
    window.addEventListener("clf-photographer-work-location-updated", onProfileUpdated);
    return () => window.removeEventListener("clf-photographer-work-location-updated", onProfileUpdated);
  }, [checkStatus]);

  function handleDismiss() {
    dismissWorkLocationPrompt();
    setOpen(false);
  }

  function handleAccept() {
    dismissWorkLocationPrompt();
    setOpen(false);

    if (variant === "cuantocobro") {
      onOpenBusinessProfile?.();
      return;
    }

    router.push("/fotografo/configuracion?tab=datos&highlight=work-location");
  }

  if (!checked) return null;

  return (
    <PhotographerWorkLocationPrompt
      open={open}
      variant={variant}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
    />
  );
}
