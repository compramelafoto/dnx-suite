/**
 * Contrato genérico de almacenamiento de media del CMS.
 * Types only — no R2 implementation.
 */
export type ContentStorageKind = "hero" | "media";

export type ContentStorageUploadInput = {
  platform: string;
  kind: ContentStorageKind;
  filename: string;
  contentType: string;
  body: Uint8Array | ArrayBuffer | Buffer;
};

export type ContentStorageUploadResult = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export interface ContentStorageAdapter {
  upload(input: ContentStorageUploadInput): Promise<ContentStorageUploadResult>;
  delete(key: string): Promise<void>;
}
