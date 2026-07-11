"use client";

import { useState } from "react";

export function ShareEventButton({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // usuario canceló o clipboard no disponible
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex h-11 w-full items-center justify-center text-sm font-medium ring-1 ring-[var(--is-border)]"
    >
      {copied ? "Enlace copiado" : "Compartir"}
    </button>
  );
}
