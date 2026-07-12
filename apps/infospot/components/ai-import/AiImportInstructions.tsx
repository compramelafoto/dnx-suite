"use client";

export function AiImportInstructions() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--is-text)]">
      <h3 className="text-base font-semibold">Preparar información</h3>
      <p>
        Subí el flyer o pegá el texto en ChatGPT, Gemini, Claude u otra IA. Info Spot no envía nada
        automáticamente.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-[var(--is-muted)]">
        <li>Captura de flyer o imagen</li>
        <li>Publicación de redes</li>
        <li>Comunicado o texto copiado</li>
      </ul>
    </div>
  );
}
