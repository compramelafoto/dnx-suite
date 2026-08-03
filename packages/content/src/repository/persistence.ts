import { Prisma, type PrismaClient } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import { ContentError } from "../errors";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";
import {
  prepareContentPostContent,
  resolvePublishedAtForStatus,
  type ContentPostCreateInput,
  type ContentPostUpdateInput,
} from "../validation/post";
import { ensureSingleFeaturedPost } from "./featured";
import { contentPostInclude } from "./post-include";

type PrismaTx = Pick<
  PrismaClient,
  "blogPost" | "blogPostTag" | "blogCategory" | "blogAuthor" | "blogTag"
>;

async function assertPostRelations(
  tx: PrismaTx,
  platform: ContentPlatform,
  data: { categoryId?: number | null; authorId?: number | null; tagIds?: number[] }
) {
  if (data.categoryId != null) {
    const category = await tx.blogCategory.findFirst({
      where: { id: data.categoryId, ...platformWhere(platform) },
      select: { id: true },
    });
    if (!category) {
      throw new ContentError("CONTENT_CATEGORY_NOT_FOUND", "CATEGORY_NOT_FOUND");
    }
  }
  if (data.authorId != null) {
    const author = await tx.blogAuthor.findFirst({
      where: { id: data.authorId, ...platformWhere(platform) },
      select: { id: true },
    });
    if (!author) {
      throw new ContentError("CONTENT_AUTHOR_NOT_FOUND", "AUTHOR_NOT_FOUND");
    }
  }
  if (data.tagIds && data.tagIds.length > 0) {
    const count = await tx.blogTag.count({
      where: { id: { in: data.tagIds }, ...platformWhere(platform) },
    });
    if (count !== data.tagIds.length) {
      throw new ContentError("CONTENT_TAG_NOT_FOUND", "TAG_NOT_FOUND");
    }
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

function syncImageFields(input: {
  heroImageUrl?: string | null;
  ogImageUrl?: string | null;
}): { heroImageUrl: string | null; ogImageUrl: string | null } {
  const hero = input.heroImageUrl?.trim() || null;
  const og = input.ogImageUrl?.trim() || null;
  const thumbnail = hero || og;
  return {
    heroImageUrl: hero,
    ogImageUrl: thumbnail,
  };
}

export async function createContentPost(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  data: ContentPostCreateInput;
}) {
  const platform = assertContentPlatform(input.platform);
  const prepared = await prepareContentPostContent(input.data.contentJson);
  const publishedAt = resolvePublishedAtForStatus(input.data.status, input.data.publishedAt);
  const tagIds = input.data.tagIds ?? [];
  const images = syncImageFields(input.data);

  return input.prisma.$transaction(async (tx) => {
    await assertPostRelations(tx, platform, {
      categoryId: input.data.categoryId,
      authorId: input.data.authorId,
      tagIds,
    });

    const post = await tx.blogPost.create({
      data: {
        platform,
        title: input.data.title,
        slug: input.data.slug,
        excerpt: input.data.excerpt,
        contentJson: prepared.contentJson as Prisma.InputJsonValue,
        contentHtml: prepared.contentHtml,
        readingTimeMin: prepared.readingTimeMin,
        heroImageUrl: images.heroImageUrl,
        status: input.data.status,
        type: input.data.type,
        publishedAt,
        lastReviewedAt: input.data.lastReviewedAt,
        isFeatured: input.data.isFeatured,
        featuredUntil: input.data.featuredUntil,
        seoTitle: input.data.seoTitle,
        seoDescription: input.data.seoDescription,
        seoGoal: input.data.seoGoal,
        ogImageUrl: images.ogImageUrl,
        canonicalUrl: input.data.canonicalUrl,
        noIndex: input.data.noIndex,
        categoryId: input.data.categoryId,
        authorId: input.data.authorId,
      },
      include: contentPostInclude,
    });

    await syncPostTags(tx, post.id, tagIds);

    if (input.data.isFeatured) {
      await ensureSingleFeaturedPost({
        prisma: tx,
        platform,
        postId: post.id,
        isFeatured: true,
      });
    }

    const reloaded = await tx.blogPost.findFirstOrThrow({
      where: { id: post.id, ...platformWhere(platform) },
      include: contentPostInclude,
    });
    return reloaded;
  });
}

export async function updateContentPost(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  postId: number;
  data: ContentPostUpdateInput;
}) {
  const platform = assertContentPlatform(input.platform);
  const existing = await input.prisma.blogPost.findFirst({
    where: { id: input.postId, ...platformWhere(platform) },
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

  const nextStatus = input.data.status ?? existing.status;
  const publishedAt = resolvePublishedAtForStatus(
    nextStatus,
    input.data.publishedAt !== undefined ? input.data.publishedAt : existing.publishedAt,
    existing.publishedAt
  );

  let contentPatch: {
    contentJson?: Prisma.InputJsonValue;
    contentHtml?: string;
    readingTimeMin?: number;
  } = {};

  if (input.data.contentJson !== undefined) {
    const prepared = await prepareContentPostContent(input.data.contentJson as JSONContent);
    contentPatch = {
      contentJson: prepared.contentJson as Prisma.InputJsonValue,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
    };
  }

  const tagIds = input.data.tagIds;
  const scalar = omitTagIds(input.data);
  const images =
    scalar.heroImageUrl !== undefined || scalar.ogImageUrl !== undefined
      ? syncImageFields({
          heroImageUrl:
            scalar.heroImageUrl !== undefined ? scalar.heroImageUrl : existing.heroImageUrl,
          ogImageUrl: scalar.ogImageUrl !== undefined ? scalar.ogImageUrl : existing.ogImageUrl,
        })
      : null;

  return input.prisma.$transaction(async (tx) => {
    await assertPostRelations(tx, platform, {
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

    const updated = await tx.blogPost.updateMany({
      where: { id: input.postId, ...platformWhere(platform) },
      data: updateData as Prisma.BlogPostUpdateManyMutationInput,
    });
    if (updated.count === 0) return null;

    if (tagIds !== undefined) {
      await syncPostTags(tx, input.postId, tagIds);
    }

    if (scalar.isFeatured === true) {
      await ensureSingleFeaturedPost({
        prisma: tx,
        platform,
        postId: input.postId,
        isFeatured: true,
      });
    }

    return tx.blogPost.findFirstOrThrow({
      where: { id: input.postId, ...platformWhere(platform) },
      include: contentPostInclude,
    });
  });
}

export async function deleteContentPost(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  postId: number;
}): Promise<boolean> {
  const platform = assertContentPlatform(input.platform);
  const result = await input.prisma.blogPost.deleteMany({
    where: { id: input.postId, ...platformWhere(platform) },
  });
  return result.count > 0;
}

export { contentPostInclude };
