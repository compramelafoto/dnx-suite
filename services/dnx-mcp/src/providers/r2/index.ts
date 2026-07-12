import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const r2Provider = createProviderStub("r2", () => {
  const env = loadEnv();
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
});
