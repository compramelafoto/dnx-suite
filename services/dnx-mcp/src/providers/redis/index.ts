import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const redisProvider = createProviderStub("redis", () => {
  const env = loadEnv();
  return Boolean(env.REDIS_URL);
});
