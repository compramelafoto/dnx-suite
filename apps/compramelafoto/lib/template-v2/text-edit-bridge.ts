/** Puente mínimo entre el overlay contentEditable y el panel lateral (insertar variables sin prop drilling). */

let editingTextBlockId: string | null = null;
const editingListeners = new Set<() => void>();

export function subscribeTemplateTextEditing(listener: () => void): () => void {
  editingListeners.add(listener);
  return () => editingListeners.delete(listener);
}

export function getTemplateTextEditingBlockId(): string | null {
  return editingTextBlockId;
}

export function notifyTemplateTextEditingBlockId(blockId: string | null): void {
  editingTextBlockId = blockId;
  editingListeners.forEach((l) => l());
}

let insertHandler: ((text: string) => void) | null = null;

export function registerTemplateTextInsert(handler: ((text: string) => void) | null): void {
  insertHandler = handler;
}

export function insertTextIntoActiveTemplateEditor(text: string): void {
  insertHandler?.(text);
}
