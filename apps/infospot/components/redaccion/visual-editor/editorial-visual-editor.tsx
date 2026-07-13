"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
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

export type EditorialVisualEditorHandle = {
  insertImage: (attrs: EditorialImageAttrs) => void;
  focus: () => void;
  /** Resalta y hace scroll a la figura con data-asset-id. */
  scrollToAsset: (assetId: string) => boolean;
  getSelectedAssetId: () => string | null;
};

type Props = {
  name?: string;
  initialMarkdown?: string;
  onMarkdownChange?: (markdown: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  articleId?: string | null;
  onCoverImported?: () => void;
  /** Cuando el cursor está sobre una figura editorial. */
  onSelectedAssetChange?: (assetId: string | null) => void;
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
      onSelectedAssetChange,
    },
    ref,
  ) {
    const [imageOpen, setImageOpen] = useState(false);
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
      onSelectionUpdate: ({ editor: ed }) => {
        if (ed.isActive("editorialImage")) {
          const id = (ed.getAttributes("editorialImage").assetId as string | null) || null;
          onSelectedAssetChange?.(id);
        } else {
          onSelectedAssetChange?.(null);
        }
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

    const scrollToAsset = useCallback(
      (assetId: string) => {
        if (!editor) return false;
        let found = false;
        editor.state.doc.descendants((node, pos) => {
          if (found) return false;
          if (node.type.name === "editorialImage" && node.attrs.assetId === assetId) {
            editor.chain().focus().setNodeSelection(pos).run();
            // Scroll DOM figure into view
            requestAnimationFrame(() => {
              const el = editor.view.nodeDOM(pos);
              if (el instanceof HTMLElement) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            });
            found = true;
            return false;
          }
          return true;
        });
        return found;
      },
      [editor],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertImage,
        focus: () => {
          editor?.commands.focus();
        },
        scrollToAsset,
        getSelectedAssetId: () => {
          if (!editor?.isActive("editorialImage")) return null;
          return (editor.getAttributes("editorialImage").assetId as string | null) || null;
        },
      }),
      [editor, insertImage, scrollToAsset],
    );

    // onCoverImported kept for API compat; local upload dialog may call parent refresh
    void onCoverImported;
    void articleId;

    return (
      <div className="is-editor-shell">
        <input type="hidden" name={name} value={markdown} />
        <EditorToolbar
          editor={editor}
          onInsertImage={() => setImageOpen(true)}
        />
        <EditorContent editor={editor} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--is-border)]/70 px-4 py-4 text-xs text-[var(--is-muted)] sm:px-6">
          <p>El material fotográfico se inserta desde la biblioteca.</p>
          <p className="tabular-nums">{wordCount} palabras</p>
        </div>

        <InsertImageDialog
          open={imageOpen}
          onClose={() => setImageOpen(false)}
          onInsert={insertImage}
          articleId={articleId}
        />
      </div>
    );
  },
);
