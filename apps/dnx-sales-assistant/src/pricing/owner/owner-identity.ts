import { z } from "zod";

export type OwnerIdentityConfig = {
  ownerEmail: string;
  telegramOwnerUserId: string;
  telegramOwnerChatId: string;
  /** Ruta opcional explícita al perfil .local del propietario. */
  profilePath?: string;
  templatesPath?: string;
};

const schema = z.object({
  DNX_OWNER_EMAIL: z.string().optional().default(""),
  DNX_TELEGRAM_OWNER_USER_ID: z.string().optional().default(""),
  DNX_TELEGRAM_OWNER_CHAT_ID: z.string().optional().default(""),
  DNX_OWNER_PRICING_PROFILE_PATH: z.string().optional().default(""),
  DNX_OWNER_PRICING_TEMPLATES_PATH: z.string().optional().default(""),
});

export function loadOwnerIdentityConfig(
  env: NodeJS.ProcessEnv = process.env,
): OwnerIdentityConfig {
  const parsed = schema.parse({
    DNX_OWNER_EMAIL: env.DNX_OWNER_EMAIL,
    DNX_TELEGRAM_OWNER_USER_ID: env.DNX_TELEGRAM_OWNER_USER_ID,
    DNX_TELEGRAM_OWNER_CHAT_ID: env.DNX_TELEGRAM_OWNER_CHAT_ID,
    DNX_OWNER_PRICING_PROFILE_PATH: env.DNX_OWNER_PRICING_PROFILE_PATH,
    DNX_OWNER_PRICING_TEMPLATES_PATH: env.DNX_OWNER_PRICING_TEMPLATES_PATH,
  });

  return {
    ownerEmail: parsed.DNX_OWNER_EMAIL.trim().toLowerCase(),
    telegramOwnerUserId: parsed.DNX_TELEGRAM_OWNER_USER_ID.trim(),
    telegramOwnerChatId: parsed.DNX_TELEGRAM_OWNER_CHAT_ID.trim(),
    profilePath: parsed.DNX_OWNER_PRICING_PROFILE_PATH.trim() || undefined,
    templatesPath: parsed.DNX_OWNER_PRICING_TEMPLATES_PATH.trim() || undefined,
  };
}

export function maskOwnerEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(5, local.length));
  return `${visible}***@${domain}`;
}

export function ownerEmailSlug(email: string): string {
  const local = email.split("@")[0] ?? "owner";
  return local.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "owner";
}
