import type {
  PublishAsset,
  PublishFormat,
  PublishResult,
  SocialAccount,
  SocialPlatform,
} from "../types";

export type ProviderPublishInput = {
  account: SocialAccount;
  accessToken: string;
  caption: string;
  assets: PublishAsset[];
  /** Sin especificar, SINGLE_IMAGE — así lo existente sigue igual. */
  format?: PublishFormat;
  /** Usuarios sin @, ya repartidos por planMentions. */
  collaborators?: string[];
  /** Si true, no llama a Meta; simula éxito. */
  dryRun: boolean;
};

export interface SocialPublishProvider {
  readonly platform: SocialPlatform;
  publish(input: ProviderPublishInput): Promise<PublishResult>;
}
