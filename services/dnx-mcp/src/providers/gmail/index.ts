import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const gmailProvider = createProviderStub("gmail", () => {
  const env = loadEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
});
