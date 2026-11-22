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
  /**
   * Solo historias: usuarios sin @ que se etiquetan en la imagen (`user_tags`). Meta lo
   * admite en historias desde julio de 2025; la persona recibe la notificación y puede
   * compartir la historia. Sin coordenadas: en historias son opcionales.
   */
  userTags?: string[];
  /** Si true, no llama a Meta; simula éxito. */
  dryRun: boolean;
};

export interface SocialPublishProvider {
  readonly platform: SocialPlatform;
  publish(input: ProviderPublishInput): Promise<PublishResult>;
}
