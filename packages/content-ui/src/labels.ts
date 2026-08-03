export type ContentUiLabels = {
  loadingEditor: string;
  loadingLibrary: string;
  emptyLibrary: string;
  mainContentTitle: string;
  titlePlaceholder: string;
  slugLabel: string;
  slugPlaceholder: string;
  excerptPlaceholder: string;
  categoryLabel: string;
  categoryEmpty: string;
  authorLabel: string;
  authorEmpty: string;
  typeLabel: string;
  tagsLabel: string;
  heroLabel: string;
  heroHelp: string;
  heroEmpty: string;
  heroUpload: string;
  heroChange: string;
  heroRemove: string;
  heroUploading: string;
  bodyLabel: string;
  seoTitle: string;
  seoTitlePlaceholder: string;
  seoDescriptionPlaceholder: string;
  seoGoalPlaceholder: string;
  sharePreviewWithHero: string;
  fallbackShareNote: string;
  canonicalPlaceholder: string;
  noIndexLabel: string;
  lastReviewedLabel: string;
  publishSectionTitle: string;
  featureUncheckedNote: string;
  featurePublishFirst: string;
  featureCheckbox: string;
  featuredUntilLabel: string;
  saveDraft: string;
  publish: string;
  archive: string;
  saveChanges: string;
  delete: string;
  saving: string;
  savedSuccess: string;
  saveError: string;
  deleteConfirm: string;
  deleteError: string;
  mediaLibraryTitle: string;
  mediaClose: string;
  mediaUpload: string;
  mediaUploading: string;
  mediaSearchPlaceholder: string;
  mediaSearch: string;
  mediaInsert: string;
  mediaCopyUrl: string;
  mediaEdit: string;
  mediaDelete: string;
  mediaDeleteConfirm: string;
  mediaSave: string;
  mediaCancel: string;
  mediaTitlePlaceholder: string;
  mediaAltPlaceholder: string;
  mediaCaptionPlaceholder: string;
  mediaUploadSuccess: string;
  mediaMetaSuccess: string;
  mediaDeleteSuccess: string;
  mediaCopySuccess: string;
  mediaCopyError: string;
  mediaLoadError: string;
  mediaUploadError: string;
  editorHint: string;
  editorLinkPrompt: string;
  editorYoutubePrompt: string;
  editorImageUrlPrompt: string;
  editorImageAltPrompt: string;
  toolbarH2: string;
  toolbarH3: string;
  toolbarBold: string;
  toolbarItalic: string;
  toolbarBullet: string;
  toolbarOrdered: string;
  toolbarLink: string;
  toolbarQuote: string;
  toolbarImageLibrary: string;
  toolbarImageUrl: string;
  toolbarYoutube: string;
  toolbarTable: string;
  toolbarUndo: string;
  toolbarRedo: string;
};

export const DEFAULT_CONTENT_UI_LABELS: ContentUiLabels = {
  loadingEditor: "Cargando editor...",
  loadingLibrary: "Cargando biblioteca...",
  emptyLibrary: "No hay imágenes en la biblioteca.",
  mainContentTitle: "Contenido principal",
  titlePlaceholder: "Título del artículo",
  slugLabel: "Slug (URL)",
  slugPlaceholder: "mi-articulo",
  excerptPlaceholder: "Resumen para listados y SEO",
  categoryLabel: "Categoría",
  categoryEmpty: "Sin categoría",
  authorLabel: "Autor",
  authorEmpty: "Sin autor",
  typeLabel: "Tipo",
  tagsLabel: "Tags",
  heroLabel: "Imagen destacada",
  heroHelp:
    "Se muestra en el artículo, en las tarjetas del listado y como miniatura al compartir el link en redes sociales.",
  heroEmpty: "Sin imagen destacada",
  heroUpload: "Subir imagen",
  heroChange: "Cambiar imagen",
  heroRemove: "Quitar",
  heroUploading: "Subiendo...",
  bodyLabel: "Cuerpo del artículo",
  seoTitle: "SEO",
  seoTitlePlaceholder: "Título SEO (opcional)",
  seoDescriptionPlaceholder: "Descripción SEO",
  seoGoalPlaceholder: "Objetivo SEO (interno, no público)",
  sharePreviewWithHero: "Vista previa en redes: usa la imagen destacada del artículo.",
  fallbackShareNote: "Sin imagen destacada: al compartir el link se mostrará el logo del sitio.",
  canonicalPlaceholder: "URL canónica (opcional)",
  noIndexLabel: "No indexar (noindex)",
  lastReviewedLabel: "Última revisión editorial",
  publishSectionTitle: "Publicación",
  featureUncheckedNote:
    "El artículo no está publicado: se quitó el destacado. Solo los artículos publicados pueden destacarse.",
  featurePublishFirst: "Para destacar un artículo, primero publicalo.",
  featureCheckbox: "Destacar en home",
  featuredUntilLabel: "Destacado hasta (opcional)",
  saveDraft: "Guardar borrador",
  publish: "Publicar",
  archive: "Archivar",
  saveChanges: "Guardar cambios",
  delete: "Eliminar",
  saving: "Guardando...",
  savedSuccess: "Artículo guardado correctamente.",
  saveError: "Error guardando artículo",
  deleteConfirm: "¿Eliminar este artículo permanentemente?",
  deleteError: "Error eliminando",
  mediaLibraryTitle: "Biblioteca multimedia",
  mediaClose: "Cerrar",
  mediaUpload: "Subir imagen",
  mediaUploading: "Subiendo...",
  mediaSearchPlaceholder: "Buscar...",
  mediaSearch: "Buscar",
  mediaInsert: "Insertar",
  mediaCopyUrl: "Copiar URL",
  mediaEdit: "Editar",
  mediaDelete: "Eliminar",
  mediaDeleteConfirm: "¿Eliminar esta imagen de la biblioteca?",
  mediaSave: "Guardar",
  mediaCancel: "Cancelar",
  mediaTitlePlaceholder: "Título",
  mediaAltPlaceholder: "Alt text",
  mediaCaptionPlaceholder: "Caption",
  mediaUploadSuccess: "Imagen subida correctamente.",
  mediaMetaSuccess: "Metadata actualizada.",
  mediaDeleteSuccess: "Imagen eliminada.",
  mediaCopySuccess: "URL copiada al portapapeles.",
  mediaCopyError: "No se pudo copiar la URL.",
  mediaLoadError: "Error cargando multimedia",
  mediaUploadError: "Error subiendo imagen",
  editorHint:
    "Usá H2–H6 para títulos dentro del artículo. El título principal de la página es el H1 del artículo.",
  editorLinkPrompt: "URL del enlace",
  editorYoutubePrompt: "URL de YouTube",
  editorImageUrlPrompt: "URL de la imagen",
  editorImageAltPrompt: "Texto alternativo (alt)",
  toolbarH2: "Título H2",
  toolbarH3: "Título H3",
  toolbarBold: "Negrita",
  toolbarItalic: "Cursiva",
  toolbarBullet: "Lista con viñetas",
  toolbarOrdered: "Lista numerada",
  toolbarLink: "Enlace",
  toolbarQuote: "Cita",
  toolbarImageLibrary: "Imagen desde biblioteca",
  toolbarImageUrl: "Imagen por URL",
  toolbarYoutube: "YouTube",
  toolbarTable: "Tabla",
  toolbarUndo: "Deshacer",
  toolbarRedo: "Rehacer",
};

export const DEFAULT_CONTENT_TYPE_LABELS: Record<string, string> = {
  BLOG: "Artículo",
  FEATURE: "Funcionalidad",
  CASE_STUDY: "Caso de éxito",
  COMPARISON: "Comparativa",
};

export function mergeContentUiLabels(partial?: Partial<ContentUiLabels>): ContentUiLabels {
  return { ...DEFAULT_CONTENT_UI_LABELS, ...partial };
}
