"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

type Props = {
  editor: Editor | null;
  onInsertImage: () => void;
  onInsertGallery: () => void;
  onInsertVideo: () => void;
};

const btn =
  "is-btn is-btn-icon !min-h-10 !min-w-10 text-sm font-medium";

const btnActive =
  "!border-[var(--is-accent)] !bg-[var(--is-accent-soft)] !text-[var(--is-accent-hover)]";

function InsertMenu({
  onInsertImage,
  onInsertGallery,
  onInsertVideo,
}: {
  onInsertImage: () => void;
  onInsertGallery: () => void;
  onInsertVideo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
        const idx = items.findIndex((el) => el === document.activeElement);
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const next = items[(idx + dir + items.length) % items.length];
        next?.focus();
      }
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: "Imagen", title: "Insertar imagen propia en el cuerpo", onSelect: onInsertImage },
    {
      label: "Galería",
      title: "Insertar galería (slideshow de varias fotos)",
      onSelect: onInsertGallery,
    },
    {
      label: "Video",
      title: "Insertar video de YouTube, Vimeo o Instagram",
      onSelect: onInsertVideo,
    },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${btn} px-3 gap-1`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Insertar imagen, galería o video"
      >
        Insertar
        <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Insertar contenido"
          className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white py-1 shadow-lg"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              title={item.title}
              className="block w-full min-h-10 px-3 text-left text-sm text-[var(--is-text)] hover:bg-[var(--is-bg-secondary)] focus-visible:bg-[var(--is-bg-secondary)] focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EditorToolbar({ editor, onInsertImage, onInsertGallery, onInsertVideo }: Props) {
  if (!editor) {
    return (
      <div className="flex min-h-12 items-center border-b border-[var(--is-border)]/70 bg-[var(--is-bg-secondary)]/60 px-3 text-sm text-[var(--is-muted)]">
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
      className="flex flex-wrap items-center gap-1 border-b border-[var(--is-border)]/70 bg-[var(--is-bg-secondary)]/50 px-2 py-1.5 sm:px-3"
    >
      <button
        type="button"
        className={`${btn} ${ed.isActive("heading", { level: 2 }) ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-pressed={ed.isActive("heading", { level: 2 })}
        aria-label="Título de sección"
        title="Título de sección"
      >
        H2
      </button>
      <button
        type="button"
        className={`${btn} ${ed.isActive("heading", { level: 3 }) ? btnActive : ""}`}
        onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-pressed={ed.isActive("heading", { level: 3 })}
        aria-label="Subtítulo"
        title="Subtítulo"
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
        aria-label="Enlace"
        title="Enlace"
      >
        Enlace
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
      <InsertMenu
        onInsertImage={onInsertImage}
        onInsertGallery={onInsertGallery}
        onInsertVideo={onInsertVideo}
      />
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
