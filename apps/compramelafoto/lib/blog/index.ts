export {
  slugifyBlog,
  slugifyBlogFromName,
  validateBlogSlug,
  parseBlogSlug,
} from "@/lib/blog/slugify-blog";

export {
  EMPTY_BLOG_CONTENT_JSON,
  createEmptyBlogContentJson,
  getBlogTiptapExtensions,
  downgradeH1InContentJson,
  contentJsonHasH1,
  extractPlainTextFromContentJson,
} from "@/lib/blog/tiptap-extensions";

export { generateBlogHtml, sanitizeBlogHtml } from "@/lib/blog/generate-blog-html";

export {
  BLOG_WORDS_PER_MINUTE,
  countWords,
  calculateReadingTimeMinutes,
  calculateReadingTimeFromContentJson,
} from "@/lib/blog/reading-time";

export {
  parseBlogPostCreate,
  parseBlogPostUpdate,
  prepareBlogPostContent,
  resolvePublishedAtForStatus,
  blogPostCreateSchema,
  blogPostUpdateSchema,
  formatBlogValidationError,
} from "@/lib/blog/validate-blog-post";

export {
  parseBlogCategoryCreate,
  parseBlogCategoryUpdate,
  blogCategoryCreateSchema,
  blogCategoryUpdateSchema,
} from "@/lib/blog/validate-blog-category";

export {
  parseBlogTagCreate,
  parseBlogTagUpdate,
  blogTagCreateSchema,
  blogTagUpdateSchema,
} from "@/lib/blog/validate-blog-tag";

export {
  parseBlogAuthorCreate,
  parseBlogAuthorUpdate,
  blogAuthorCreateSchema,
  blogAuthorUpdateSchema,
} from "@/lib/blog/validate-blog-author";

export {
  buildBlogArticleJsonLd,
  serializeBlogArticleJsonLd,
} from "@/lib/blog/blog-json-ld";
export type { BlogArticleJsonLdInput } from "@/lib/blog/blog-json-ld";

export {
  getBlogSiteUrl,
  getBlogHomeUrl,
  getBlogPostUrl,
  getBlogCategoryUrl,
  getBlogTagUrl,
  toAbsoluteBlogAssetUrl,
} from "@/lib/blog/blog-site-url";

export {
  buildBlogHomeMetadata,
  buildBlogArticleMetadata,
  buildBlogCategoryMetadata,
  buildBlogTagMetadata,
} from "@/lib/blog/blog-metadata";

export { parseBlogSeoGoal } from "@/lib/blog/blog-seo-goal";

export {
  unsetOtherFeaturedBlogPosts,
  ensureSingleFeaturedBlogPost,
} from "@/lib/blog/unset-other-featured";

export {
  createBlogPostRecord,
  updateBlogPostRecord,
  mapPostResponse,
  postInclude,
} from "@/lib/blog/post-persistence";
