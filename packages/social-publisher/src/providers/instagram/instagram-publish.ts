import { createHash, randomUUID } from "node:crypto";
import type { PublishResult } from "../../types";
import { SocialPublisherError } from "../../types";
import type { ProviderPublishInput, SocialPublishProvider } from "../types";
import { createMetaGraphClient } from "./graph-client";

/**
 * Instagram Content Publishing API (image).
 * create media container → publish → permalink.
 * Dry-run por defecto cuando no hay LIVE.
 */
export function createInstagramPublishProvider(options?: {
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): SocialPublishProvider {
  const client = createMetaGraphClient({
    apiVersion: options?.apiVersion,
    fetchImpl: options?.fetchImpl,
  });

  return {
    platform: "INSTAGRAM",
    async publish(input: ProviderPublishInput): Promise<PublishResult> {
      const image = input.assets.find((a) => a.kind === "IMAGE" && a.publicUrl);
      if (!image?.publicUrl) {
        throw new SocialPublisherError(
          "ASSET_URL_REQUIRED",
          "Instagram requiere publicUrl del asset",
          false,
        );
      }
      if (input.account.status !== "ACTIVE") {
        throw new SocialPublisherError(
          "ACCOUNT_INACTIVE",
          "Cuenta social no activa",
          false,
        );
      }

      if (input.dryRun) {
        const hash = createHash("sha256")
          .update(image.publicUrl)
          .update(input.caption)
          .digest("hex")
          .slice(0, 16);
        return {
          ok: true,
          dryRun: true,
          externalMediaId: `dry_media_${hash}`,
          externalPostId: `dry_post_${randomUUID().slice(0, 8)}`,
          permalink: `https://www.instagram.com/p/dry_${hash}/`,
          providerRawSanitized: { mode: "dry_run" },
        };
      }

      const igUserId = input.account.externalAccountId;
      const container = await client.request<{ id: string }>(
        `/${igUserId}/media`,
        {
          method: "POST",
          accessToken: input.accessToken,
          form: true,
          body: {
            image_url: image.publicUrl,
            caption: input.caption,
          },
        },
      );

      const published = await client.request<{ id: string }>(
        `/${igUserId}/media_publish`,
        {
          method: "POST",
          accessToken: input.accessToken,
          form: true,
          body: { creation_id: container.id },
        },
      );

      let permalink: string | null = null;
      try {
        const media = await client.request<{ permalink?: string }>(
          `/${published.id}`,
          {
            accessToken: input.accessToken,
          },
        );
        // permalink via fields query
        void media;
        const withFields = await client.request<{ permalink?: string }>(
          `/${published.id}?fields=permalink`,
          { accessToken: input.accessToken },
        );
        permalink = withFields.permalink ?? null;
      } catch {
        permalink = null;
      }

      return {
        ok: true,
        dryRun: false,
        externalMediaId: container.id,
        externalPostId: published.id,
        permalink,
        providerRawSanitized: {
          containerId: container.id,
          mediaId: published.id,
        },
      };
    },
  };
}
