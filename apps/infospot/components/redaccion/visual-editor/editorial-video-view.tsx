"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { resolveEditorialVideo, type EditorialVideoAttrs } from "@repo/editor";
import { VideoEmbed } from "@/components/editorial/video-embed";
import { VideoEmbedFallback } from "@/components/editorial/video-embed-fallback";

export type VideoEditRequest = {
  attrs: EditorialVideoAttrs;
  apply: (attrs: EditorialVideoAttrs) => void;
};

type Props = NodeViewProps & {
  onRequestEdit?: (request: VideoEditRequest) => void;
};

export function EditorialVideoNodeView({
  node,
  selected,
  deleteNode,
  updateAttributes,
  onRequestEdit,
}: Props) {
  const resolved = resolveEditorialVideo(node.attrs as EditorialVideoAttrs);

  if (!resolved.ok) {
    return (
      <NodeViewWrapper as="div" className="is-video-node" data-drag-handle="">
        <VideoEmbedFallback url={typeof node.attrs.url === "string" ? node.attrs.url : null} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="is-video-node" data-drag-handle="">
      <VideoEmbed
        video={resolved.value}
        selected={selected}
        showEditorChrome
        onEdit={
          onRequestEdit
            ? () =>
                onRequestEdit({
                  attrs: resolved.value,
                  apply: (next) => updateAttributes(next),
                })
            : undefined
        }
        onDelete={deleteNode}
      />
    </NodeViewWrapper>
  );
}
