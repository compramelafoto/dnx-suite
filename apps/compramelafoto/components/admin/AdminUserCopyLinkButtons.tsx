"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  buildAdminLandingUrl,
  type AdminLandingKind,
} from "@/lib/admin/user-public-links";

const miniBtnClass =
  "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium leading-none text-gray-700 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40";

function MiniCopyButton({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      className={miniBtnClass}
      onClick={handleCopy}
      title={`Copiar link de ${label.toLowerCase()}`}
      aria-label={`Copiar link de ${label.toLowerCase()}`}
    >
      {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden /> : <Copy className="h-3 w-3 shrink-0" aria-hidden />}
      {copied ? "Copiado" : label}
    </button>
  );
}

export default function AdminUserCopyLinkButtons({
  landingUrl: landingUrlProp,
  landingKind,
  publicPageHandler,
  referralUrl,
}: {
  landingUrl?: string | null;
  landingKind?: AdminLandingKind;
  publicPageHandler?: string | null;
  referralUrl?: string | null;
}) {
  const landingUrl =
    landingUrlProp ??
    (landingKind
      ? buildAdminLandingUrl(
          landingKind,
          publicPageHandler,
          typeof window !== "undefined" ? window.location.origin : undefined
        )
      : null);

  if (!landingUrl && !referralUrl) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {landingUrl ? <MiniCopyButton label="Landing" url={landingUrl} /> : null}
      {referralUrl ? <MiniCopyButton label="Referidos" url={referralUrl} /> : null}
    </div>
  );
}
