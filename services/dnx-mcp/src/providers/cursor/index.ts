import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const cursorProvider = createProviderStub("cursor", () => {
  const env = loadEnv();
  return Boolean(env.CURSOR_API_KEY);
});
