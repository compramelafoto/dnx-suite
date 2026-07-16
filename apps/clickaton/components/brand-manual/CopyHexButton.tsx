"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type CopyHexButtonProps = {
  hex: string;
  className?: string;
};

export function CopyHexButton({ hex, className }: CopyHexButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
      aria-label={`Copiar color ${hex}`}
    >
      {copied ? "Copiado" : "Copiar código"}
    </Button>
  );
}
