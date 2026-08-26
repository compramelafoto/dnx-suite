"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import {
  countWordsFromHtml,
  editorHtmlToMarkdown,
  EditorialVideo,
  getEditorialExtensions,
  markdownToEditorHtml,
  sanitizePastedHtml,
  type EditorialImageAttrs,
  type EditorialVideoAttrs,
} from "@repo/editor";
import { EditorToolbar } from "@/components/redaccion/visual-editor/editor-toolbar";
import { InsertImageDialog } from "@/components/redaccion/visual-editor/insert-image-dialog";
import { InsertVideoDialog } from "@/components/redaccion/visual-editor/insert-video-dialog";
import {
  EditorialVideoNodeView,
  type VideoEditRequest,
} from "@/components/redaccion/visual-editor/editorial-video-view";

export type EditorialVisualEditorHandle = {
  insertImage: (attrs: EditorialImageAttrs) => void;
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
    const [videoOpen, setVideoOpen] = useState(false);
    const [videoEdit, setVideoEdit] = useState<VideoEditRequest | null>(null);
    const [wordCount, setWordCount] = useState(0);
    const [markdown, setMarkdown] = useState(initialMarkdown);
    const videoEditHandler = useRef<(request: VideoEditRequest) => void>(() => {});

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

    const extensions = useMemo(
      () =>
        getEditorialExtensions({
          placeholder: "Escribí la historia. El material preparado está a la derecha.",
          withPlaceholder: true,
        }).map((ext) => {
          if (ext.name !== "editorialVideo") return ext;
          return EditorialVideo.extend({
            addNodeView() {
              return ReactNodeViewRenderer((props) => (
                <EditorialVideoNodeView
                  {...props}
                  onRequestEdit={(request) => videoEditHandler.current(request)}
                />
              ));
            },
          });
        }),
      [],
    );

    const editor = useEditor({
      extensions,
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
      videoEditHandler.current = (request) => {
        setVideoEdit(request);
        setVideoOpen(true);
      };
    }, []);

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

    const insertVideo = useCallback(
      (attrs: EditorialVideoAttrs) => {
        if (videoEdit) {
          videoEdit.apply(attrs);
          setVideoEdit(null);
          setVideoOpen(false);
          if (editor) syncFromEditor(editor.getHTML(), true);
          return;
        }
        if (!editor) return;
        editor.chain().focus().setEditorialVideo(attrs).run();
        syncFromEditor(editor.getHTML(), true);
        setVideoOpen(false);
      },
      [editor, syncFromEditor, videoEdit],
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
      [editor, insertImage, scrollToAsset, removeAssetFromText],
    );

    void onCoverImported;
    void articleId;

    return (
      <div className="is-editor-shell">
        <input type="hidden" name={name} value={markdown} />
        <EditorToolbar
          editor={editor}
          onInsertImage={() => setImageOpen(true)}
          onInsertVideo={() => {
            setVideoEdit(null);
            setVideoOpen(true);
          }}
        />
        <EditorContent editor={editor} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--is-border)]/70 px-4 py-4 text-xs text-[var(--is-muted)] sm:px-6">
          <p>El material fotográfico se inserta desde la biblioteca. Los videos van con Insertar video.</p>
          <p className="tabular-nums">{wordCount} palabras</p>
        </div>

        <InsertImageDialog
          open={imageOpen}
          onClose={() => setImageOpen(false)}
          onInsert={insertImage}
          articleId={articleId}
        />
        <InsertVideoDialog
          open={videoOpen}
          onClose={() => {
            setVideoOpen(false);
            setVideoEdit(null);
          }}
          onInsert={insertVideo}
          initial={videoEdit?.attrs ?? null}
        />
      </div>
    );
  },
);
