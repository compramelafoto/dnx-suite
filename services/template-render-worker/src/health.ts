import { chromium } from "playwright-core";
import { RENDERER_VERSION } from "./types.js";

export type HealthSnapshot = {
  ok: boolean;
  rendererVersion: string;
  browserAvailable: boolean;
};

export async function probeBrowserAvailable(): Promise<boolean> {
  try {
    const executablePath = chromium.executablePath();
    if (!executablePath) return false;

    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const browserAvailable = await probeBrowserAvailable();
  return {
    ok: browserAvailable,
    rendererVersion: RENDERER_VERSION,
    browserAvailable,
  };
}
