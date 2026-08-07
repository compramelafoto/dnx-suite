"use client";

import { useEffect, type ReactNode } from "react";
import {
  captureScrollPosition,
  restoreScrollPosition,
} from "@/lib/admin/preserve-scroll";

type Props = {
  children: ReactNode;
};

/**
 * Evita saltos al tope tras submits de forms (server actions) o clicks de botones
 * que disparen revalidación RSC en páginas largas de admin.
 */
export function AdminScrollStability({ children }: Props) {
  useEffect(() => {
    let restoreTimers: number[] = [];
    let clearWatch: number | null = null;

    const armRestore = () => {
      const pos = captureScrollPosition();
      for (const t of restoreTimers) window.clearTimeout(t);
      if (clearWatch != null) window.clearTimeout(clearWatch);
      restoreTimers = [0, 50, 100, 200, 400, 700].map((ms) =>
        window.setTimeout(() => restoreScrollPosition(pos), ms),
      );
      clearWatch = window.setTimeout(() => {
        restoreTimers = [];
        clearWatch = null;
      }, 900);
    };

    const onSubmit = () => armRestore();
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button, [type='submit'], input[type='file']");
      if (!button) return;
      armRestore();
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      for (const t of restoreTimers) window.clearTimeout(t);
      if (clearWatch != null) window.clearTimeout(clearWatch);
    };
  }, []);

  return <>{children}</>;
}
