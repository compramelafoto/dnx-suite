// Abre Chrome para que Daniel inicie sesión él mismo en ComprameLaFoto.
// Cuando la sesión es de admin, entra a la demo escolar como fotógrafo y guarda la sesión en sesion.json.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire("/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/node_modules/.pnpm/playwright@1.51.1/node_modules/playwright/");
const { chromium } = require("playwright");
const DIR = new URL(".", import.meta.url).pathname;
const BASE = "https://compramelafoto.com";

const ctx = await chromium.launchPersistentContext(DIR + "perfil", { channel: "chrome", headless: false, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(BASE + "/login");
console.log("VENTANA ABIERTA: esperando que inicies sesión…");
const hasta = Date.now() + 15 * 60_000;
while (Date.now() < hasta) {
  await new Promise((r) => setTimeout(r, 4000));
  try {
    const r = await page.request.post(BASE + "/api/admin/demos/escolar/entrar");
    if (r.ok()) {
      await ctx.storageState({ path: DIR + "sesion.json" });
      fs.chmodSync(DIR + "sesion.json", 0o600);
      console.log("LISTO: sesión de la demo guardada");
      await page.goto(BASE + "/fotografo/dashboard");
      await new Promise((r) => setTimeout(r, 3000));
      await ctx.close();
      process.exit(0);
    }
  } catch {}
}
console.log("SE VENCIÓ EL TIEMPO");
await ctx.close();
process.exit(1);
