import { randomBytes } from "node:crypto";
export {
  buildCaption,
  createInMemorySocialPublisherStore,
  createInstagramPublishProvider,
  createSocialPublisherEngine,
  decryptSecret,
  encryptSecret,
  isDue,
  nextRetryAt,
  planSchedule,
  SocialPublisherError,
} from "./index";

export function encodeSocialMasterKeyForTest(): Buffer {
  return randomBytes(32);
}
