/**
 * Copiar al portapapeles un texto que todavía hay que pedirle al servidor (p. ej. un link de
 * canje que se genera al tocar el botón).
 *
 * `navigator.clipboard.writeText` llamado después de un `await` falla en Safari y en algunos
 * navegadores embebidos ("Write permission denied"): el permiso del toque se pierde mientras
 * se espera la respuesta. `ClipboardItem` acepta una promesa, así que la escritura arranca
 * dentro del mismo toque y el texto llega después.
 *
 * Devuelve el texto y si se pudo copiar: cuando no se puede, quien llama lo muestra para
 * copiarlo a mano. Llamar sincrónicamente desde el `onClick`, sin `await` antes.
 */

export type CopyPendingResult = { text: string; copied: boolean };

type ClipboardLike = {
  write?: (items: unknown[]) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

export async function copyPendingText(
  pending: Promise<string>,
  env: {
    clipboard?: ClipboardLike | null;
    ClipboardItemCtor?: (new (items: Record<string, Promise<Blob>>) => unknown) | null;
  } = {
    clipboard: typeof navigator !== "undefined" ? (navigator.clipboard as ClipboardLike) : null,
    ClipboardItemCtor:
      typeof ClipboardItem !== "undefined"
        ? (ClipboardItem as unknown as new (items: Record<string, Promise<Blob>>) => unknown)
        : null,
  }
): Promise<CopyPendingResult> {
  const { clipboard, ClipboardItemCtor } = env;
  let escritura: Promise<void> | null = null;
  if (clipboard?.write && ClipboardItemCtor) {
    try {
      escritura = clipboard.write([
        new ClipboardItemCtor({ "text/plain": pending.then((t) => new Blob([t], { type: "text/plain" })) }),
      ]);
      // Si el texto nunca llega, esta escritura también falla: no dejarla sin atender.
      escritura.catch(() => {});
    } catch {
      escritura = null;
    }
  }

  // Si el texto no llega, el error es del servidor y lo maneja quien llama.
  const text = await pending;

  if (escritura) {
    try {
      await escritura;
      return { text, copied: true };
    } catch {
      /* sigue con writeText */
    }
  }
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return { text, copied: true };
    } catch {
      /* sin permiso: se copia a mano */
    }
  }
  return { text, copied: false };
}
