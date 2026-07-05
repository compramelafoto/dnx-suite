import { Prisma } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import type { PrismaClient } from "@prisma/client";
import { mapPostResponse, postInclude } from "@/lib/blog/post-queries";
import { ensureSingleFeaturedBlogPost } from "@/lib/blog/unset-other-featured";
import { syncBlogPostImageFields } from "@/lib/blog/blog-post-images";
import {
  prepareBlogPostContent,
  resolvePublishedAtForStatus,
  type BlogPostCreateInput,
  type BlogPostUpdateInput,
} from "@/lib/blog/validate-blog-post";

export { mapPostResponse, postInclude };

type PrismaTx = Pick<
  PrismaClient,
  "blogPost" | "blogPostTag" | "blogCategory" | "blogAuthor" | "blogTag"
>;

async function assertPostRelations(
  tx: PrismaTx,
  data: { categoryId?: number | null; authorId?: number | null; tagIds?: number[] }
) {
  if (data.categoryId != null) {
    const category = await tx.blogCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
  }
  if (data.authorId != null) {
    const author = await tx.blogAuthor.findUnique({ where: { id: data.authorId }, select: { id: true } });
    if (!author) throw new Error("AUTHOR_NOT_FOUND");
  }
  if (data.tagIds && data.tagIds.length > 0) {
    const count = await tx.blogTag.count({ where: { id: { in: data.tagIds } } });
    if (count !== data.tagIds.length) throw new Error("TAG_NOT_FOUND");
  }
}

async function syncPostTags(tx: PrismaTx, postId: number, tagIds: number[]) {
  await tx.blogPostTag.deleteMany({ where: { postId } });
  if (tagIds.length === 0) return;
  await tx.blogPostTag.createMany({
    data: tagIds.map((tagId) => ({ postId, tagId })),
    skipDuplicates: true,
  });
}

function omitTagIds<T extends { tagIds?: number[] }>(input: T) {
  const { tagIds: _tagIds, ...rest } = input;
  return rest;
}

export async function createBlogPostRecord(prisma: PrismaClient, input: BlogPostCreateInput) {
  const prepared = await prepareBlogPostContent(input.contentJson);
  const publishedAt = resolvePublishedAtForStatus(input.status, input.publishedAt);
  const tagIds = input.tagIds ?? [];
  const images = syncBlogPostImageFields(input);

  return prisma.$transaction(async (tx) => {
    await assertPostRelations(tx, {
      categoryId: input.categoryId,
      authorId: input.authorId,
      tagIds,
    });

    const post = await tx.blogPost.create({
      data: {
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        contentJson: prepared.contentJson as Prisma.InputJsonValue,
        contentHtml: prepared.contentHtml,
        readingTimeMin: prepared.readingTimeMin,
        heroImageUrl: images.heroImageUrl,
        status: input.status,
        type: input.type,
        publishedAt,
        lastReviewedAt: input.lastReviewedAt,
        isFeatured: input.isFeatured,
        featuredUntil: input.featuredUntil,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        seoGoal: input.seoGoal,
        ogImageUrl: images.ogImageUrl,
        canonicalUrl: input.canonicalUrl,
        noIndex: input.noIndex,
        categoryId: input.categoryId,
        authorId: input.authorId,
      },
      include: postInclude,
    });

    await syncPostTags(tx, post.id, tagIds);

    if (input.isFeatured) {
      await ensureSingleFeaturedBlogPost(tx, post.id, true);
    }

    return tx.blogPost.findUniqueOrThrow({
      where: { id: post.id },
      include: postInclude,
    });
  });
}

export async function updateBlogPostRecord(
  prisma: PrismaClient,
  postId: number,
  input: BlogPostUpdateInput
) {
  const existing = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      contentJson: true,
      heroImageUrl: true,
      ogImageUrl: true,
    },
  });
  if (!existing) return null;

  const nextStatus = input.status ?? existing.status;
  const publishedAt = resolvePublishedAtForStatus(
    nextStatus,
    input.publishedAt !== undefined ? input.publishedAt : existing.publishedAt,
    existing.publishedAt
  );

  let contentPatch: {
    contentJson?: Prisma.InputJsonValue;
    contentHtml?: string;
    readingTimeMin?: number;
  } = {};

  if (input.contentJson !== undefined) {
    const prepared = await prepareBlogPostContent(input.contentJson as JSONContent);
    contentPatch = {
      contentJson: prepared.contentJson as Prisma.InputJsonValue,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
    };
  }

  const tagIds = input.tagIds;
  const scalar = omitTagIds(input);
  const images =
    scalar.heroImageUrl !== undefined || scalar.ogImageUrl !== undefined
      ? syncBlogPostImageFields({
          heroImageUrl:
            scalar.heroImageUrl !== undefined ? scalar.heroImageUrl : existing.heroImageUrl,
          ogImageUrl: scalar.ogImageUrl !== undefined ? scalar.ogImageUrl : existing.ogImageUrl,
        })
      : null;

  return prisma.$transaction(async (tx) => {
    await assertPostRelations(tx, {
      categoryId: scalar.categoryId,
      authorId: scalar.authorId,
      tagIds,
    });

    const updateData: Prisma.BlogPostUpdateInput = {
      ...(scalar.title !== undefined ? { title: scalar.title } : {}),
      ...(scalar.slug !== undefined ? { slug: scalar.slug } : {}),
      ...(scalar.excerpt !== undefined ? { excerpt: scalar.excerpt } : {}),
      ...contentPatch,
      ...(images ? { heroImageUrl: images.heroImageUrl, ogImageUrl: images.ogImageUrl } : {}),
      ...(scalar.status !== undefined ? { status: scalar.status } : {}),
      ...(scalar.type !== undefined ? { type: scalar.type } : {}),
      publishedAt,
      ...(scalar.lastReviewedAt !== undefined ? { lastReviewedAt: scalar.lastReviewedAt } : {}),
      ...(scalar.isFeatured !== undefined ? { isFeatured: scalar.isFeatured } : {}),
      ...(scalar.featuredUntil !== undefined ? { featuredUntil: scalar.featuredUntil } : {}),
      ...(scalar.seoTitle !== undefined ? { seoTitle: scalar.seoTitle } : {}),
      ...(scalar.seoDescription !== undefined ? { seoDescription: scalar.seoDescription } : {}),
      ...(scalar.seoGoal !== undefined ? { seoGoal: scalar.seoGoal } : {}),
      ...(scalar.canonicalUrl !== undefined ? { canonicalUrl: scalar.canonicalUrl } : {}),
      ...(scalar.noIndex !== undefined ? { noIndex: scalar.noIndex } : {}),
      ...(scalar.categoryId !== undefined ? { categoryId: scalar.categoryId } : {}),
      ...(scalar.authorId !== undefined ? { authorId: scalar.authorId } : {}),
    };

    await tx.blogPost.update({
      where: { id: postId },
      data: updateData,
    });

    if (tagIds !== undefined) {
      await syncPostTags(tx, postId, tagIds);
    }

    if (scalar.isFeatured === true) {
      await ensureSingleFeaturedBlogPost(tx, postId, true);
    }

    return tx.blogPost.findUniqueOrThrow({
      where: { id: postId },
      include: postInclude,
    });
  });
}

export function mapRelationError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "CATEGORY_NOT_FOUND") return "La categoría indicada no existe";
  if (message === "AUTHOR_NOT_FOUND") return "El autor indicado no existe";
  if (message === "TAG_NOT_FOUND") return "Uno o más tags no existen";
  return null;
}
