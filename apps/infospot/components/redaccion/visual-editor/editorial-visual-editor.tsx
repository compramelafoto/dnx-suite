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
  type EditorialGalleryAttrs,
  type EditorialImageAttrs,
} from "@repo/editor";
import { EditorToolbar } from "@/components/redaccion/visual-editor/editor-toolbar";
import { InsertImageDialog } from "@/components/redaccion/visual-editor/insert-image-dialog";
import { InsertGalleryDialog } from "@/components/redaccion/visual-editor/insert-gallery-dialog";
import {
  EditorialGalleryWithNodeView,
  GalleryEditContext,
} from "@/components/redaccion/visual-editor/editorial-gallery-node-view";

export type EditorialVisualEditorHandle = {
  insertImage: (attrs: EditorialImageAttrs) => void;
  insertGallery: (attrs: EditorialGalleryAttrs) => void;
  focus: () => void;
  /** Resalta y hace scroll a la figura con data-asset-id. */
  scrollToAsset: (assetId: string) => boolean;
  /** Quita la figura del cuerpo (no desvincula el material de la nota). */
  removeAssetFromText: (assetId: string) => boolean;
  getSelectedAssetId: () => string | null;
};

type Props = {
  name?: string;
  initialMarkdown?: string;
  onMarkdownChange?: (markdown: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  articleId?: string | null;
  /** Álbum CLF vinculado — habilita la pestaña CLF en "Insertar galería". */
  clfAlbumId?: number | null;
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
      clfAlbumId,
      onCoverImported,
      onSelectedAssetChange,
    },
    ref,
  ) {
    const [imageOpen, setImageOpen] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryEdit, setGalleryEdit] = useState<{
      attrs: EditorialGalleryAttrs;
      updateAttributes: (attrs: Partial<EditorialGalleryAttrs>) => void;
    } | null>(null);
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
        galleryNode: EditorialGalleryWithNodeView,
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
        if (!editor) return;
        editor.chain().focus().setEditorialImage(attrs).run();
        // Forzar sync inmediato: no depender solo de onUpdate (evita autosave sin figura).
        syncFromEditor(editor.getHTML(), true);
        setImageOpen(false);
      },
      [editor, syncFromEditor],
    );

    const insertGallery = useCallback(
      (attrs: EditorialGalleryAttrs) => {
        if (!editor) return;
        editor.chain().focus().setEditorialGallery(attrs).run();
        syncFromEditor(editor.getHTML(), true);
        setGalleryOpen(false);
        setGalleryEdit(null);
      },
      [editor, syncFromEditor],
    );

    const requestGalleryEdit = useCallback(
      (
        attrs: EditorialGalleryAttrs,
        updateAttributes: (attrs: Partial<EditorialGalleryAttrs>) => void,
      ) => {
        setGalleryEdit({ attrs, updateAttributes });
        setGalleryOpen(true);
      },
      [],
    );

    const submitGallery = useCallback(
      (attrs: EditorialGalleryAttrs) => {
        if (galleryEdit) {
          galleryEdit.updateAttributes(attrs);
          if (editor) syncFromEditor(editor.getHTML(), true);
          setGalleryOpen(false);
          setGalleryEdit(null);
          return;
        }
        insertGallery(attrs);
      },
      [galleryEdit, editor, syncFromEditor, insertGallery],
    );

    const scrollToAsset = useCallback(
      (assetId: string) => {
        if (!editor) return false;
        let found = false;
        editor.state.doc.descendants((node, pos) => {
          if (found) return false;
          if (node.type.name === "editorialImage" && node.attrs.assetId === assetId) {
            editor.chain().focus().setNodeSelection(pos).run();
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

    const removeAssetFromText = useCallback(
      (assetId: string) => {
        if (!editor) return false;
        const ranges: { from: number; to: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "editorialImage" && node.attrs.assetId === assetId) {
            ranges.push({ from: pos, to: pos + node.nodeSize });
          }
        });
        if (ranges.length === 0) return false;
        let chain = editor.chain().focus();
        for (const range of ranges.reverse()) {
          chain = chain.deleteRange(range);
        }
        chain.run();
        syncFromEditor(editor.getHTML(), true);
        return true;
      },
      [editor, syncFromEditor],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertImage,
        insertGallery,
        focus: () => {
          editor?.commands.focus();
        },
        scrollToAsset,
        removeAssetFromText,
        getSelectedAssetId: () => {
          if (!editor?.isActive("editorialImage")) return null;
          return (editor.getAttributes("editorialImage").assetId as string | null) || null;
        },
      }),
      [editor, insertImage, insertGallery, scrollToAsset, removeAssetFromText],
    );

    void onCoverImported;
    void articleId;

    return (
      <div className="is-editor-shell">
        <input type="hidden" name={name} value={markdown} />
        <EditorToolbar
          editor={editor}
          onInsertImage={() => setImageOpen(true)}
          onInsertGallery={() => {
            setGalleryEdit(null);
            setGalleryOpen(true);
          }}
        />
        <GalleryEditContext.Provider value={requestGalleryEdit}>
          <EditorContent editor={editor} />
        </GalleryEditContext.Provider>
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

        <InsertGalleryDialog
          open={galleryOpen}
          onClose={() => {
            setGalleryOpen(false);
            setGalleryEdit(null);
          }}
          onSubmit={submitGallery}
          articleId={articleId}
          clfAlbumId={clfAlbumId}
          initialAttrs={galleryEdit?.attrs ?? null}
        />
      </div>
    );
  },
);
