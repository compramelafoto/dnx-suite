import type { ContentMediaItem } from "./types";

export type ContentMediaMetaUpdate = {
  title?: string;
  altText?: string;
  caption?: string;
};

/**
 * Adapter de biblioteca multimedia inyectado por la app host.
 * Sin fetch hardcodeado: la app implementa contra sus rutas/API.
 */
export type ContentMediaAdapter = {
  listMedia: (input?: { q?: string; limit?: number }) => Promise<ContentMediaItem[]>;
  uploadMedia: (file: File) => Promise<ContentMediaItem>;
  updateMedia: (id: number, meta: ContentMediaMetaUpdate) => Promise<ContentMediaItem | void>;
  deleteMedia: (id: number) => Promise<void>;
  /** Endpoint de hero distinto al de biblioteca (opcional). */
  uploadHero?: (file: File) => Promise<{ url: string }>;
};

/**
 * Transporte opcional de alto nivel para posts (alternativa a callbacks sueltos).
 * El formulario actual usa `onSubmit` / `onDelete` directamente.
 */
export type ContentAdminTransport = {
  createPost: (payload: unknown) => Promise<{ id: number; status: string; slug: string }>;
  updatePost: (
    id: number,
    payload: unknown
  ) => Promise<{ id?: number; status: string; slug: string }>;
  deletePost: (id: number) => Promise<void>;
};
