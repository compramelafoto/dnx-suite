import type { PublishAsset, PublishResult, SocialAccount, SocialPlatform } from "../types";

export type ProviderPublishInput = {
  account: SocialAccount;
  accessToken: string;
  caption: string;
  assets: PublishAsset[];
  /** Si true, no llama a Meta; simula éxito. */
  dryRun: boolean;
};

export interface SocialPublishProvider {
  readonly platform: SocialPlatform;
  publish(input: ProviderPublishInput): Promise<PublishResult>;
}
