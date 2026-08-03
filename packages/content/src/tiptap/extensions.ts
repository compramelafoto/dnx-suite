import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Youtube from "@tiptap/extension-youtube";
import StarterKit from "@tiptap/starter-kit";

export {
  EMPTY_CONTENT_JSON,
  EMPTY_BLOG_CONTENT_JSON,
  createEmptyContentJson,
  createEmptyBlogContentJson,
  downgradeH1InContentJson,
  contentJsonHasH1,
  extractPlainTextFromContentJson,
} from "./content-utils";

/**
 * Extensiones compartidas entre el editor admin (cliente) y generateHTML (servidor).
 * H1 excluido: el título del artículo es el único H1 de la página.
 */
export function getContentTiptapExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: {
        levels: [2, 3, 4, 5, 6],
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
      },
    }),
    Image.configure({
      HTMLAttributes: {
        loading: "lazy",
        decoding: "async",
      },
    }),
    Youtube.configure({
      inline: false,
      width: 640,
      height: 360,
      HTMLAttributes: {
        class: "blog-youtube-embed",
      },
    }),
    Table.configure({
      resizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

/** Alias CLF. */
export const getBlogTiptapExtensions = getContentTiptapExtensions;
