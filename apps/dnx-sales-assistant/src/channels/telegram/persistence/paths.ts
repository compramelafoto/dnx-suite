import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Override para tests: DNX_TELEGRAM_LOCAL_DIR */
export function telegramLocalDir(): string {
  const override = process.env.DNX_TELEGRAM_LOCAL_DIR?.trim();
  if (override) return path.resolve(override);
  return path.resolve(__dirname, "../../../../.local/telegram");
}

export function telegramSessionsPath(): string {
  return path.join(telegramLocalDir(), "sessions.json");
}

export function telegramUpdatesPath(): string {
  return path.join(telegramLocalDir(), "updates.json");
}

export function telegramReviewsPath(): string {
  return path.join(telegramLocalDir(), "reviews.json");
}

export function telegramFlagsPath(): string {
  return path.join(telegramLocalDir(), "flags.json");
}
