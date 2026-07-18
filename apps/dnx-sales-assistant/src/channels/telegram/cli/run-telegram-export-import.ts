import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { telegramLocalDir } from "../persistence/paths.js";
import { TelegramLocalStore } from "../persistence/telegram-local-store.js";

export async function runTelegramExportLocal(): Promise<{
  exitCode: number;
  lines: string[];
  filePath?: string;
}> {
  const store = new TelegramLocalStore();
  await store.load();
  const payload = store.exportLocalPayload();
  const blob = JSON.stringify(payload);
  if (/bot_?token|DNX_TELEGRAM_BOT_TOKEN/i.test(blob)) {
    return {
      exitCode: 1,
      lines: ["ERROR: el export no debe incluir token"],
    };
  }

  await mkdir(telegramLocalDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(
    telegramLocalDir(),
    `telegram-local-export-${stamp}.json`,
  );
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    exitCode: 0,
    lines: [
      "Export local Telegram (sin token ni perfil financiero)",
      `Archivo: .local/telegram/${path.basename(filePath)}`,
    ],
    filePath,
  };
}

export async function runTelegramImportLocal(filePath: string): Promise<{
  exitCode: number;
  lines: string[];
}> {
  if (!filePath || filePath.includes("..")) {
    return { exitCode: 1, lines: ["Ruta inválida"] };
  }
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  if (!absolute.includes(`${path.sep}.local${path.sep}`)) {
    return {
      exitCode: 1,
      lines: ["Solo se permiten imports desde rutas .local/"],
    };
  }

  const raw = await readFile(absolute, "utf8");
  if (/bot_?token|DNX_TELEGRAM_BOT_TOKEN/i.test(raw)) {
    return { exitCode: 1, lines: ["Export inválido: contiene token"] };
  }
  const payload = JSON.parse(raw) as unknown;
  const store = new TelegramLocalStore();
  await store.load();
  await store.importLocalPayload(payload);
  return {
    exitCode: 0,
    lines: ["Import local aplicado (updates/flags/reviews)."],
  };
}
