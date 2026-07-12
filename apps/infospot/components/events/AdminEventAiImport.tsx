"use client";

import { useState } from "react";
import { AiImportButton, AiImportDialog } from "@/components/ai-import";
import type { AiImportMergeMode, CategoryOption, EventFormImportValues } from "@/lib/ai-import";

type Props = {
  formId: string;
  categories: CategoryOption[];
};

function asFormControl(
  node: Element | null | undefined,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (!node) return null;
  const tag = node.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  }
  return null;
}

function getNamedControl(
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = form.elements.namedItem(name);
  if (!el) return null;
  if ("length" in el && !(el instanceof HTMLElement)) {
    return asFormControl((el as RadioNodeList).item(0));
  }
  return asFormControl(el as Element);
}

function readField(form: HTMLFormElement, name: string): string {
  const input = getNamedControl(form, name);
  return input ? String(input.value ?? "") : "";
}

function writeField(form: HTMLFormElement, name: string, value: string, replace: boolean) {
  const input = getNamedControl(form, name);
  if (!input) return;
  if (!value.trim()) return;
  if (replace || !String(input.value ?? "").trim()) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function AdminEventAiImport({ formId, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  function formHasValues(): boolean {
    if (typeof document === "undefined") return false;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return false;
    return ["title", "description", "city", "province", "organizerName"].some(
      (n) => Boolean(readField(form, n).trim()),
    );
  }

  function apply(payload: { mode: AiImportMergeMode; eventValues?: EventFormImportValues }) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const v = payload.eventValues;
    if (!form || !v) return;
    const replace = payload.mode === "replace_all";
    writeField(form, "title", v.title ?? "", replace);
    writeField(form, "categoryId", v.categoryId ?? "", replace);
    writeField(form, "summary", v.summary ?? "", replace);
    writeField(form, "description", v.description ?? "", replace);
    writeField(form, "startAt", v.startAt ?? "", replace);
    writeField(form, "endAt", v.endAt ?? "", replace);
    writeField(form, "venueName", v.venueName ?? "", replace);
    writeField(form, "city", v.city ?? "", replace);
    writeField(form, "province", v.province ?? "", replace);
    writeField(form, "address", v.address ?? "", replace);
    writeField(form, "organizerName", v.organizerName ?? "", replace);
    writeField(form, "organizerEmail", v.organizerEmail ?? "", replace);
    writeField(form, "organizerPhone", v.organizerPhone ?? "", replace);
    writeField(form, "organizerWebsite", v.organizerWebsite ?? "", replace);
    writeField(form, "registrationUrl", v.registrationUrl ?? "", replace);
    writeField(form, "sourceUrl", v.sourceUrl ?? "", replace);
    if (v.notesForEditor) {
      writeField(form, "internalNotes", v.notesForEditor, replace);
    }
    setBanner(
      v.notesForEditor
        ? `Importación aplicada. Revisá: ${v.notesForEditor}`
        : "Importación aplicada. Revisá y guardá los cambios.",
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--is-muted)]">
          Completá desde un flyer o texto con IA (sin publicar automáticamente).
        </p>
        <AiImportButton onClick={() => setOpen(true)} />
      </div>
      {banner ? (
        <p className="rounded-[var(--is-radius-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {banner}
        </p>
      ) : null}
      <AiImportDialog
        open={open}
        onClose={() => setOpen(false)}
        context="EVENT"
        categories={categories}
        hasExistingValues={formHasValues()}
        onApply={apply}
      />
    </div>
  );
}
