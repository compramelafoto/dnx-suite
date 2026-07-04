"use client";

import { useState } from "react";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "";
}


function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-600">{label}</span>
      <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[280px]" title={url}>
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="text-sm font-medium text-[#c27b3d] hover:underline whitespace-nowrap"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export default function CommunityAltaLinks() {
  const base = getBaseUrl();
  const linkProveedores = base ? `${base}/comunidad/proveedores/alta` : "";
  const linkParaFotografos = base ? `${base}/comunidad/para-fotografos/alta` : "";
  return (
    <div className="rounded-lg border border-gray-200 bg-amber-50/50 p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Links de alta (formularios públicos)</h2>
      <div className="space-y-2">
        <CopyButton url={linkProveedores} label="Link alta Proveedores:" />
        <CopyButton url={linkParaFotografos} label="Link alta Para fotógrafos:" />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Copiá y enviá por WhatsApp para que empresas se registren en el directorio.
      </p>
    </div>
  );
}
