import type { ConsoleMessage, Page, Response } from "@playwright/test";
import { ALLOWED_CONSOLE_ERROR_PATTERNS } from "../env";

export type ConsoleGuard = {
  assertClean: () => void;
  errors: string[];
  networkFailures: string[];
};

export function attachConsoleGuard(page: Page): ConsoleGuard {
  const errors: string[] = [];
  const networkFailures: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ALLOWED_CONSOLE_ERROR_PATTERNS.some((re) => re.test(text))) return;
    errors.push(text.slice(0, 500));
  });

  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`.slice(0, 500));
  });

  page.on("response", (res: Response) => {
    const url = res.url();
    if (!url.includes("/api/template-v2/")) return;
    if (res.status() >= 500) {
      networkFailures.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });

  return {
    errors,
    networkFailures,
    assertClean() {
      const critical = [...errors, ...networkFailures];
      if (critical.length > 0) {
        throw new Error(`Errores de consola/red no permitidos:\n- ${critical.join("\n- ")}`);
      }
    },
  };
}
