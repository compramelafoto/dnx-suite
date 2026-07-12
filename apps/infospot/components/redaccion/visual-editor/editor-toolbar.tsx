"use client";

import type { Editor } from "@tiptap/react";

type Props = {
  editor: Editor | null;
  onInsertImage: () => void;
  onInsertFromClf?: () => void;
  canUseClf?: boolean;
};

const btn =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-transparent px-2.5 text-sm font-medium text-[var(--is-text-secondary)] hover:border-[var(--is-border)] hover:bg-white hover:text-[var(--is-text)] disabled:opacity-40";

const btnActive =
  "border-[var(--is-accent)] bg-[var(--is-accent-soft)] text-[var(--is-accent-hover)]";

export function EditorToolbar({
  editor,
  onInsertImage,
  onInsertFromClf,
  canUseClf = false,
}: Props) {
  if (!editor) {
    return (
      <div className="flex min-h-14 items-center border-b border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-3 text-sm text-[var(--is-muted)]">
        Cargando editor…
      </div>
    );
  }

  const ed = editor;

  function setLink() {
    const previous = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    ed.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div
      role="toolbar"
      aria-label="Formato del cuerpo"
      className="flex flex-wrap items-center gap-1 border-b border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-2 py-2 sm:px-3"
    >
      <button
        type="button"
        className={`${btn} ${ed.isActive("heading", { level: 2 }) ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-pressed={ed.isActive("heading", { level: 2 })}
      >
        H2
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("heading", { level: 3 }) ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-pressed={ed.isActive("heading", { level: 3 })}
      >
        H3
      </button>
      <span className="mx-1 h-6 w-px bg-[var(--is-border)]" aria-hidden />
      <button
        type="button"
        className={`${btn} ${ed.isActive("bold") ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleBold().run()}
        aria-pressed={ed.isActive("bold")}
        title="Negrita"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("italic") ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleItalic().run()}
        aria-pressed={ed.isActive("italic")}
        title="Cursiva"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("link") ? btnActive : ""}`}
        onClick={setLink}
        aria-pressed={ed.isActive("link")}
        title="Enlace"
      >
        Link
      </button>
      <span className="mx-1 h-6 w-px bg-[var(--is-border)]" aria-hidden />
      <button
        type="button"
        className={`${btn} ${ed.isActive("bulletList") ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleBulletList().run()}
        aria-pressed={ed.isActive("bulletList")}
        title="Lista con viñetas"
      >
        • Lista
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("orderedList") ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleOrderedList().run()}
        aria-pressed={ed.isActive("orderedList")}
        title="Lista numerada"
      >
        1. Lista
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("blockquote") ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleBlockquote().run()}
        aria-pressed={ed.isActive("blockquote")}
        title="Cita"
      >
        Cita
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => ed.chain().focus().setHorizontalRule().run()}
        title="Separador"
      >
        —
      </button>
      <button type="button" className={btn} onClick={onInsertImage} title="Insertar imagen">
        Imagen
      </button>
      {canUseClf && onInsertFromClf ? (
        <button
          type="button"
          className={`${btn} px-3`}
          onClick={onInsertFromClf}
          title="Elegir desde ComprameLaFoto"
        >
          Desde CLF
        </button>
      ) : null}
      <span className="mx-1 h-6 w-px bg-[var(--is-border)]" aria-hidden />
      <button
        type="button"
        className={btn}
        disabled={!ed.can().undo()}
        onClick={() => ed.chain().focus().undo().run()}
        title="Deshacer"
      >
        ↩
      </button>
      <button
        type="button"
        className={btn}
        disabled={!ed.can().redo()}
        onClick={() => ed.chain().focus().redo().run()}
        title="Rehacer"
      >
        ↪
      </button>
    </div>
  );
}
