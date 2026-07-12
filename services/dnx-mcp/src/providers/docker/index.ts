import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const dockerProvider = createProviderStub("docker", () => {
  const env = loadEnv();
  return Boolean(env.DOCKER_HOST);
});
