"use client";

import { PRIVACY_WARNING } from "@/lib/ai-import";

export function AiImportPrivacyWarning() {
  return (
    <p className="mb-5 rounded-[var(--is-radius-sm)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
      {PRIVACY_WARNING}
    </p>
  );
}

export function AiImportWarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2 rounded-[var(--is-radius-sm)] border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-950">
      {warnings.map((w) => (
        <li key={w}>• {w}</li>
      ))}
    </ul>
  );
}
