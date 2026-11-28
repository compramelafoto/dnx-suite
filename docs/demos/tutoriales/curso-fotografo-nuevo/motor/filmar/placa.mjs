// Renderiza placas HTML a PNG 1920x1080. Uso: node placa.mjs salida.png archivo.html  (o varias parejas)
import { createRequire } from "module";
const require = createRequire("/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/node_modules/.pnpm/playwright@1.51.1/node_modules/playwright/");
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (let i = 0; i < args.length; i += 2) {
  await p.goto("file://" + args[i + 1]); await p.waitForTimeout(400);
  await p.screenshot({ path: args[i], omitBackground: args[i].includes("-capa") });
}
await b.close();
