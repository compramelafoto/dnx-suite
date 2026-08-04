/**
 * Punto de entrada de la capa CMS local de Clickatón (CMS ETAPA 06).
 * Todo lo que toca base de datos pasa por wrappers con `platform = "clickaton"`.
 */
export {
  CLICKATON_CONTENT_PLATFORM,
  CONTENT_PLATFORMS,
  clickatonPlatformWhere,
  isContentPlatform,
  stripClientPlatform,
} from "@/lib/content/content-platform";
export type {
  ClickatonContentPlatform,
  ContentPlatform,
} from "@/lib/content/content-platform";

export {
  CLICKATON_CONTENT_ACCENT,
  CLICKATON_CONTENT_ACCENT_STYLE,
  CLICKATON_CONTENT_LABELS,
  CLICKATON_CONTENT_STATUS_LABELS,
  CLICKATON_CONTENT_TYPE_LABELS,
} from "@/lib/content/content-labels";

export {
  CLICKATON_BLOG_BASE_PATH,
  blogCategoryPath,
  blogHomePath,
  blogPostPath,
  blogTagPath,
  clickatonContentSite,
  getClickatonBlogOrigin,
  toAbsoluteBlogUrl,
} from "@/lib/content/content-site-config";

export {
  BLOG_IMAGE_ALLOWED_TYPES,
  BLOG_IMAGE_MAX_BYTES,
  CLICKATON_BLOG_KEY_PATTERN,
  CLICKATON_BLOG_KEY_ROOT,
  blogKeyPrefix,
  buildBlogObjectKey,
  deleteBlogImage,
  extensionForMimeType,
  getClickatonBlogStorage,
  isClickatonBlogKey,
  uploadBlogImage,
  validateBlogImageFile,
} from "@/lib/content/blog-storage";
export type {
  ClickatonBlogNamespace,
  UploadedBlogImage,
} from "@/lib/content/blog-storage";

export {
  contentErrorStatus,
  handleContentApiError,
  mapContentRelationError,
} from "@/lib/content/content-errors";

export {
  normalizeOptionalString,
  parseListLimit,
  parseRouteId,
  requireContentAdminApi,
  trimOptionalFormValue,
} from "@/lib/content/admin-route-utils";

export {
  createClickatonPost,
  deleteClickatonPost,
  mapContentPostResponse,
  updateClickatonPost,
} from "@/lib/content/post-persistence";

export {
  getClickatonAdminPost,
  listClickatonAdminPosts,
  listClickatonAuthors,
  listClickatonCategories,
  listClickatonMedia,
  listClickatonTags,
} from "@/lib/content/admin-queries";

export {
  CLICKATON_BLOG_VISITOR_COOKIE,
  CLICKATON_BLOG_VISITOR_MAX_AGE,
  isClickatonBlogArticlePath,
  resolveClickatonBlogVisitorKey,
} from "@/lib/content/visitor";
