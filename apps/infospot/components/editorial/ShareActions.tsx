"use client";

import { useEffect, useState } from "react";
import { Cluster } from "@/components/foundations";

type Props = {
  title: string;
  url?: string;
};

/** Acciones de share visuales; copiar enlace funcional. */
export function ShareActions({ title, url }: Props) {
  const [copied, setCopied] = useState(false);
  const [href, setHref] = useState(url ?? "");

  useEffect(() => {
    if (!url && typeof window !== "undefined") {
      setHref(window.location.href);
    }
  }, [url]);

  async function copyLink() {
    const target = href || window.location.href;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Cluster gap={3} className="items-center">
      <p className="is-eyebrow mr-1">Compartir</p>
      <button
        type="button"
        className="is-btn is-btn-secondary min-h-11 px-4 text-sm"
        onClick={copyLink}
        aria-live="polite"
      >
        {copied ? "Enlace copiado" : "Copiar enlace"}
      </button>
      <span className="is-metadata hidden sm:inline" title={title}>
        Redes próximamente
      </span>
    </Cluster>
  );
}
