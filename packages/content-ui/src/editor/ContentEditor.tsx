"use client";

import { useCallback, useEffect } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { getContentTiptapExtensions } from "@repo/content";
import { DEFAULT_CONTENT_UI_LABELS, type ContentUiLabels } from "../labels";
import { ToolbarButton } from "./ToolbarButton";

export type ContentEditorProps = {
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  onPickImage?: () => void;
  disabled?: boolean;
  insertImage?: { url: string; alt: string } | null;
  insertImageKey?: number;
  onImageInserted?: () => void;
  placeholder?: string;
  className?: string;
  accentClassName?: string;
  labels?: Partial<Pick<
    ContentUiLabels,
    | "loadingEditor"
    | "editorHint"
    | "editorLinkPrompt"
    | "editorYoutubePrompt"
    | "editorImageUrlPrompt"
    | "editorImageAltPrompt"
    | "toolbarH2"
    | "toolbarH3"
    | "toolbarBold"
    | "toolbarItalic"
    | "toolbarBullet"
    | "toolbarOrdered"
    | "toolbarLink"
    | "toolbarQuote"
    | "toolbarImageLibrary"
    | "toolbarImageUrl"
    | "toolbarYoutube"
    | "toolbarTable"
    | "toolbarUndo"
    | "toolbarRedo"
  >>;
};

export function ContentEditor({
  value,
  onChange,
  onPickImage,
  disabled,
  insertImage,
  insertImageKey,
  onImageInserted,
  placeholder,
  className,
  accentClassName,
  labels: labelsPartial,
}: ContentEditorProps) {
  const labels = { ...DEFAULT_CONTENT_UI_LABELS, ...labelsPartial };

  const editor = useEditor({
    extensions: getContentTiptapExtensions(),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: placeholder
      ? {
          attributes: {
            "data-placeholder": placeholder,
          },
        }
      : undefined,
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
    const url = window.prompt(labels.editorLinkPrompt, previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, labels.editorLinkPrompt]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt(labels.editorYoutubePrompt);
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor, labels.editorYoutubePrompt]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt(labels.editorImageUrlPrompt);
    if (!url) return;
    const alt = window.prompt(labels.editorImageAltPrompt, "") || "";
    editor.chain().focus().setImage({ src: url, alt }).run();
  }, [editor, labels.editorImageAltPrompt, labels.editorImageUrlPrompt]);

  if (!editor) {
    return <p className="text-sm text-gray-500">{labels.loadingEditor}</p>;
  }

  const rootClass = ["rounded-lg border border-gray-300 bg-white overflow-hidden", className, accentClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2">
        <ToolbarButton
          title={labels.toolbarH2}
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarH3}
          disabled={disabled}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarBold}
          disabled={disabled}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarItalic}
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarBullet}
          disabled={disabled}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarOrdered}
          disabled={disabled}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton title={labels.toolbarLink} disabled={disabled} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarQuote}
          disabled={disabled}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Cita
        </ToolbarButton>
        {onPickImage ? (
          <ToolbarButton title={labels.toolbarImageLibrary} disabled={disabled} onClick={onPickImage}>
            Img
          </ToolbarButton>
        ) : null}
        <ToolbarButton title={labels.toolbarImageUrl} disabled={disabled} onClick={insertImageUrl}>
          Img URL
        </ToolbarButton>
        <ToolbarButton title={labels.toolbarYoutube} disabled={disabled} onClick={addYoutube}>
          YouTube
        </ToolbarButton>
        <ToolbarButton title={labels.toolbarTable} disabled={disabled} onClick={insertTable}>
          Tabla
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarUndo}
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </ToolbarButton>
        <ToolbarButton
          title={labels.toolbarRedo}
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="content-ui-tiptap-editor min-h-[280px] px-4 py-3 prose prose-sm max-w-none focus:outline-none"
      />
      <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">{labels.editorHint}</p>
      <style>{`
        .content-ui-tiptap-editor .ProseMirror {
          min-height: 280px;
          outline: none;
        }
        .content-ui-tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .content-ui-tiptap-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
        }
        .content-ui-tiptap-editor .ProseMirror td,
        .content-ui-tiptap-editor .ProseMirror th {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
        }
        .content-ui-tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid var(--content-ui-accent, #525252);
          margin-left: 0;
          padding-left: 1rem;
          color: #4b5563;
        }
        .content-ui-tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
        .content-ui-tiptap-editor .ProseMirror .blog-youtube-embed {
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
