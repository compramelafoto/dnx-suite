// Platform
export {
  CONTENT_PLATFORMS,
  contentPlatformSchema,
  isContentPlatform,
  assertContentPlatform,
  platformWhere,
  type ContentPlatform,
} from "./platform";

// Errors
export {
  CONTENT_ERROR_CODES,
  ContentError,
  isContentError,
  type ContentErrorCode,
} from "./errors";

// Contracts (types only — no side effects)
export {
  type SubmitContentToInfoSpotInput,
  submitContentToInfoSpotInputSchema,
} from "./contracts/infospot";
export {
  CONTENT_EVENT_TYPES,
  contentEventTypeSchema,
  contentEventPayloadSchema,
  type ContentEventType,
  type ContentEventPayload,
} from "./contracts/events";
export {
  type ContentStorageKind,
  type ContentStorageUploadInput,
  type ContentStorageUploadResult,
  type ContentStorageAdapter,
} from "./contracts/storage";

// Slug
export {
  normalizeContentSlug,
  validateContentSlugFormat,
  parseContentSlug,
  slugifyFromName,
  type ContentSlugValidationResult,
} from "./slug";

// Reading time
export {
  CONTENT_WORDS_PER_MINUTE,
  BLOG_WORDS_PER_MINUTE,
  countWords,
  calculateReadingTimeMinutes,
  calculateReadingTimeFromContentJson,
} from "./reading-time";

// TipTap
export {
  EMPTY_CONTENT_JSON,
  EMPTY_BLOG_CONTENT_JSON,
  createEmptyContentJson,
  createEmptyBlogContentJson,
  downgradeH1InContentJson,
  contentJsonHasH1,
  extractPlainTextFromContentJson,
} from "./tiptap/content-utils";
export {
  getContentTiptapExtensions,
  getBlogTiptapExtensions,
} from "./tiptap/extensions";
export {
  sanitizeContentHtml,
  sanitizeBlogHtml,
  generateContentHtml,
  generateBlogHtml,
} from "./tiptap/html";

// Enums
export {
  CONTENT_POST_STATUS_VALUES,
  CONTENT_POST_TYPE_VALUES,
  BLOG_POST_STATUS_VALUES,
  BLOG_POST_TYPE_VALUES,
  parseContentPostStatusFilter,
  parseContentPostTypeFilter,
  parseBlogPostStatusFilter,
  parseBlogPostTypeFilter,
  type ContentPostStatusValue,
  type ContentPostTypeValue,
  type BlogPostStatusValue,
  type BlogPostTypeValue,
} from "./enums";

// Validation
export {
  formatContentValidationError,
  formatBlogValidationError,
} from "./validation/shared";
export {
  contentCategoryCreateSchema,
  contentCategoryUpdateSchema,
  blogCategoryCreateSchema,
  blogCategoryUpdateSchema,
  parseContentCategoryCreate,
  parseContentCategoryUpdate,
  parseBlogCategoryCreate,
  parseBlogCategoryUpdate,
  type ContentCategoryCreateInput,
  type ContentCategoryUpdateInput,
  type BlogCategoryCreateInput,
  type BlogCategoryUpdateInput,
} from "./validation/category";
export {
  contentTagCreateSchema,
  contentTagUpdateSchema,
  blogTagCreateSchema,
  blogTagUpdateSchema,
  parseContentTagCreate,
  parseContentTagUpdate,
  parseBlogTagCreate,
  parseBlogTagUpdate,
  type ContentTagCreateInput,
  type ContentTagUpdateInput,
  type BlogTagCreateInput,
  type BlogTagUpdateInput,
} from "./validation/tag";
export {
  contentAuthorCreateSchema,
  contentAuthorUpdateSchema,
  blogAuthorCreateSchema,
  blogAuthorUpdateSchema,
  parseContentAuthorCreate,
  parseContentAuthorUpdate,
  parseBlogAuthorCreate,
  parseBlogAuthorUpdate,
  type ContentAuthorCreateInput,
  type ContentAuthorUpdateInput,
  type BlogAuthorCreateInput,
  type BlogAuthorUpdateInput,
} from "./validation/author";
export {
  contentPostCreateSchema,
  contentPostUpdateSchema,
  blogPostCreateSchema,
  blogPostUpdateSchema,
  prepareContentPostContent,
  prepareBlogPostContent,
  resolvePublishedAtForStatus,
  parseContentPostCreate,
  parseContentPostUpdate,
  parseBlogPostCreate,
  parseBlogPostUpdate,
  type ContentPostCreateInput,
  type ContentPostUpdateInput,
  type BlogPostCreateInput,
  type BlogPostUpdateInput,
  type PreparedContentPostContent,
  type PreparedBlogPostContent,
} from "./validation/post";

// SEO
export {
  buildContentCanonicalUrl,
  buildContentOpenGraph,
  buildArticleJsonLd,
  type BuildArticleJsonLdInput,
} from "./seo";

// Repository
export {
  publicPostListSelect,
  publicPostDetailSelect,
  listPublishedPosts,
  getFeaturedPublishedPost,
  getLatestPublishedPosts,
  getAllPublishedPostsForHome,
  getPublishedPostBySlug,
  getPublishedPostsByCategorySlug,
  getPublishedPostsByTagSlug,
  listCategoriesForHome,
  mapPublicPostTags,
  type PublicContentPostListItem,
  type PublicBlogPostListItem,
  type PublicContentPostSearchItem,
  type PublicBlogPostSearchItem,
  type PublicContentPostDetail,
  type PublicBlogPostDetail,
} from "./repository/public-queries";
export {
  createContentPost,
  updateContentPost,
  deleteContentPost,
} from "./repository/persistence";
export {
  contentPostInclude,
  postInclude,
  mapContentPostResponse,
  mapPostResponse,
  type AdminContentPostDetail,
  type AdminBlogPostDetail,
} from "./repository/post-include";
export {
  unsetOtherFeaturedPosts,
  ensureSingleFeaturedPost,
} from "./repository/featured";
export {
  listAdminPosts,
  getAdminPostById,
  type AdminContentPostRow,
  type ListAdminPostsFilters,
} from "./repository/admin";
export { getContentSitemapEntries } from "./repository/sitemap";
export { incrementViewCount } from "./repository/views";
