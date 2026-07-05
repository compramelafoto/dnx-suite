"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ROSTER_CHATGPT_CSV_CONVERSION_PROMPT } from "@/lib/roster/chatgpt-csv-conversion-prompt";

type RosterImportChatGptTipPanelProps = {
  className?: string;
};

export function RosterImportChatGptTipPanel({ className }: RosterImportChatGptTipPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ROSTER_CHATGPT_CSV_CONVERSION_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permiso de portapapeles o contexto no seguro
    }
  }, []);

  return (
    <section
      className={cn(
        "w-full min-w-[min(100%,20rem)] rounded-xl border border-violet-200/90 bg-violet-50/60 px-4 py-4 sm:px-5 sm:py-4",
        className,
      )}
      aria-labelledby="roster-chatgpt-tip-heading"
    >
      <h3 id="roster-chatgpt-tip-heading" className="text-sm font-semibold text-violet-950">
        Dato útil
      </h3>
      <p className="ds-readable-text ds-readable-text--fluid mt-2 text-sm leading-relaxed text-violet-950/90 m-0">
        Si querés pasar tu planilla o listado escolar (por ejemplo copiado desde Excel) a{" "}
        <strong className="font-semibold text-violet-950">texto CSV</strong> compatible con ComprameLaFoto, podés usar
        ChatGPT u otra IA: pegá el listado de alumnos y, en el mismo chat, enviá también el siguiente prompt como
        instrucción. Luego revisá el CSV que devuelva y pegalo en el cuadro de importación.
      </p>
      <p className="ds-readable-text ds-readable-text--fluid mt-2 text-xs leading-snug text-violet-900/75 m-0">
        Es una herramienta de terceros: conviene revisar tildes, DNIs y columnas antes de procesar la importación.
      </p>
      <div className="mt-3">
        <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={() => void handleCopy()}>
          {copied ? (
            <>
              <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              Prompt copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copiar prompt para ChatGPT
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
