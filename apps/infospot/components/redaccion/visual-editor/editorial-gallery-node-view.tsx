"use client";

import { createContext, useContext } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { EditorialGallery, type EditorialGalleryAttrs } from "@repo/editor";

type GalleryEditRequest = (
  attrs: EditorialGalleryAttrs,
  updateAttributes: (attrs: Partial<EditorialGalleryAttrs>) => void,
) => void;

/**
 * Puente entre el NodeView (dentro del árbol de TipTap) y el diálogo de
 * edición que vive en EditorialVisualEditor (mismo árbol de React vía
 * portal de ReactNodeViewRenderer, así que el context sí se propaga).
 */
export const GalleryEditContext = createContext<GalleryEditRequest | null>(null);

function EditorialGalleryNodeViewComponent(props: NodeViewProps) {
  const requestEdit = useContext(GalleryEditContext);
  const attrs = props.node.attrs as EditorialGalleryAttrs;
  const count = Array.isArray(attrs.images) ? attrs.images.length : 0;

  return (
    <NodeViewWrapper
      className="is-editorial-figure my-4 rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)]/60 p-4"
      data-drag-handle
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Galería · {count} foto{count === 1 ? "" : "s"}
          </p>
          {attrs.title ? (
            <p className="text-xs text-[var(--is-muted)]">{attrs.title}</p>
          ) : null}
        </div>
        <button
          type="button"
          contentEditable={false}
          className="min-h-9 rounded border border-[var(--is-border-strong)] bg-white px-3 text-sm font-medium"
          onClick={() =>
            requestEdit?.(attrs, (patch) => props.updateAttributes(patch))
          }
        >
          Editar galería
        </button>
      </div>
      {count > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {attrs.images.slice(0, 6).map((img) => (
            <div
              key={img.id}
              className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[var(--is-border)]"
            >
              {img.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Nodo editorialGallery con NodeView interactivo (solo para uso en el editor cliente). */
export const EditorialGalleryWithNodeView = EditorialGallery.extend({
  addNodeView() {
    return ReactNodeViewRenderer(EditorialGalleryNodeViewComponent);
  },
});
