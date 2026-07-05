"use client";

import { useCallback, useEffect } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { getBlogTiptapExtensions } from "@/lib/blog/tiptap-extensions";

type TiptapEditorProps = {
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  onPickImage?: () => void;
  disabled?: boolean;
  insertImage?: { url: string; alt: string } | null;
  insertImageKey?: number;
  onImageInserted?: () => void;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium border ${
        active
          ? "bg-[#c27b3d] text-white border-[#c27b3d]"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export default function TiptapEditor({
  value,
  onChange,
  onPickImage,
  disabled,
  insertImage,
  insertImageKey,
  onImageInserted,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: getBlogTiptapExtensions(),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current !== incoming) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || !insertImage?.url) return;
    editor.chain().focus().setImage({ src: insertImage.url, alt: insertImage.alt }).run();
    onImageInserted?.();
  }, [editor, insertImage, insertImageKey, onImageInserted]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL de YouTube");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL de la imagen");
    if (!url) return;
    const alt = window.prompt("Texto alternativo (alt)", "") || "";
    editor.chain().focus().setImage({ src: url, alt }).run();
  }, [editor]);

  if (!editor) {
    return <p className="text-sm text-gray-500">Cargando editor...</p>;
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2">
        <ToolbarButton
          title="Título H2"
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Título H3"
          disabled={disabled}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          title="Negrita"
          disabled={disabled}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          title="Cursiva"
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          title="Lista con viñetas"
          disabled={disabled}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          disabled={disabled}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton title="Enlace" disabled={disabled} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          title="Cita"
          disabled={disabled}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Cita
        </ToolbarButton>
        {onPickImage ? (
          <ToolbarButton title="Imagen desde biblioteca" disabled={disabled} onClick={onPickImage}>
            Img
          </ToolbarButton>
        ) : null}
        <ToolbarButton title="Imagen por URL" disabled={disabled} onClick={insertImageUrl}>
          Img URL
        </ToolbarButton>
        <ToolbarButton title="YouTube" disabled={disabled} onClick={addYoutube}>
          YouTube
        </ToolbarButton>
        <ToolbarButton title="Tabla" disabled={disabled} onClick={insertTable}>
          Tabla
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="blog-tiptap-editor min-h-[280px] px-4 py-3 prose prose-sm max-w-none focus:outline-none"
      />
      <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Usá H2–H6 para títulos dentro del artículo. El título principal de la página es el H1 del artículo.
      </p>
      <style jsx global>{`
        .blog-tiptap-editor .ProseMirror {
          min-height: 280px;
          outline: none;
        }
        .blog-tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .blog-tiptap-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
        }
        .blog-tiptap-editor .ProseMirror td,
        .blog-tiptap-editor .ProseMirror th {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
        }
        .blog-tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid #c27b3d;
          margin-left: 0;
          padding-left: 1rem;
          color: #4b5563;
        }
        .blog-tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
        .blog-tiptap-editor .ProseMirror .blog-youtube-embed {
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
