import { loadEnv } from "../../config/index.js";
import { createProviderStub } from "../base/index.js";

export const mercadopagoProvider = createProviderStub("mercadopago", () => {
  const env = loadEnv();
  return Boolean(env.MERCADOPAGO_ACCESS_TOKEN);
});
