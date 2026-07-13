"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  countWordsFromHtml,
  editorHtmlToMarkdown,
  getEditorialExtensions,
  markdownToEditorHtml,
  sanitizePastedHtml,
  type EditorialImageAttrs,
} from "@repo/editor";
import { EditorToolbar } from "@/components/redaccion/visual-editor/editor-toolbar";
import { InsertImageDialog } from "@/components/redaccion/visual-editor/insert-image-dialog";
import { ClfPhotoPickerDialog } from "@/components/redaccion/visual-editor/clf-photo-picker-dialog";

export type EditorialVisualEditorHandle = {
  insertImage: (attrs: EditorialImageAttrs) => void;
  focus: () => void;
};

type Props = {
  name?: string;
  initialMarkdown?: string;
  onMarkdownChange?: (markdown: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  articleId?: string | null;
  onCoverImported?: () => void;
};

export const EditorialVisualEditor = forwardRef<EditorialVisualEditorHandle, Props>(
  function EditorialVisualEditor(
    {
      name = "content",
      initialMarkdown = "",
      onMarkdownChange,
      onDirtyChange,
      articleId,
      onCoverImported,
    },
    ref,
  ) {
    const [imageOpen, setImageOpen] = useState(false);
    const [clfOpen, setClfOpen] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const [markdown, setMarkdown] = useState(initialMarkdown);

    const initialHtml = useMemo(
      () => markdownToEditorHtml(initialMarkdown),
      [initialMarkdown],
    );

    const syncFromEditor = useCallback(
      (html: string, emitDirty: boolean) => {
        const next = editorHtmlToMarkdown(html);
        setMarkdown(next);
        setWordCount(countWordsFromHtml(html));
        onMarkdownChange?.(next);
        if (emitDirty) onDirtyChange?.(true);
      },
      [onDirtyChange, onMarkdownChange],
    );

    const editor = useEditor({
      extensions: getEditorialExtensions({
        placeholder: "Escribí la historia. El material preparado está a la derecha.",
        withPlaceholder: true,
      }),
      content: initialHtml,
      editorProps: {
        attributes: {
          class:
            "is-visual-editor min-h-[min(60vh,32rem)] px-4 py-5 sm:px-6 sm:py-6 focus:outline-none",
          "aria-label": "Cuerpo de la historia",
        },
        transformPastedHTML(html) {
          return sanitizePastedHtml(html);
        },
      },
      onUpdate: ({ editor: ed }) => {
        syncFromEditor(ed.getHTML(), true);
      },
      immediatelyRender: false,
    });

    useEffect(() => {
      if (!editor) return;
      setWordCount(countWordsFromHtml(editor.getHTML()));
    }, [editor]);

    const insertImage = useCallback(
      (attrs: EditorialImageAttrs) => {
        editor?.chain().focus().setEditorialImage(attrs).run();
        setImageOpen(false);
        onDirtyChange?.(true);
      },
      [editor, onDirtyChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertImage,
        focus: () => {
          editor?.commands.focus();
        },
      }),
      [editor, insertImage],
    );

    return (
      <div className="overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white">
        <input type="hidden" name={name} value={markdown} />
        <EditorToolbar
          editor={editor}
          onInsertImage={() => setImageOpen(true)}
          canUseClf={Boolean(articleId)}
          onInsertFromClf={() => setClfOpen(true)}
        />
        <EditorContent editor={editor} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--is-border)] px-4 py-3 text-xs text-[var(--is-muted)] sm:px-6">
          <p>Atajos: ⌘/Ctrl+B negrita · ⌘/Ctrl+I cursiva · ⌘/Ctrl+Z deshacer</p>
          <p className="tabular-nums">{wordCount} palabras</p>
        </div>

        <InsertImageDialog
          open={imageOpen}
          onClose={() => setImageOpen(false)}
          onInsert={insertImage}
          articleId={articleId}
        />

        {articleId ? (
          <ClfPhotoPickerDialog
            open={clfOpen}
            onClose={() => setClfOpen(false)}
            articleId={articleId}
            onInsertInline={insertImage}
            onCoverImported={() => {
              onDirtyChange?.(true);
              onCoverImported?.();
            }}
          />
        ) : null}
      </div>
    );
  },
);
