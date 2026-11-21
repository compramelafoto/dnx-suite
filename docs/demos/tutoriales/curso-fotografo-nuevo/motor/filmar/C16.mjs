import { grabar, DIR } from "./lib.mjs";
// Compra desde el celular, con la sesión del fotógrafo (ve todas las fotos). Se oculta el aviso «Vista de fotógrafo».
// NO se toca «Confirmar pedido».
const foto = (h, n) => h.p.screenshot({ path: DIR + "mira/K-" + n + ".png" });
await grabar("C16", { celular: true }, async (h) => {
  const p = h.p; const s = (x, ms) => h.señalar(x, ms, 6).catch(() => console.log("falta", String(x).slice(0, 70)));
  const vis = (t, ex = true) => p.getByText(t, { exact: ex }).filter({ visible: true }).first();
  await h.ir("/a/city-tour-caminito-y-san-telmo---15-de-noviembre-b0fe13e8"); await h.esperar(1500);
  await p.evaluate(() => { const el = [...document.querySelectorAll("div,section,aside")].filter(e => e.innerText && e.innerText.trim().startsWith("Vista de fotógrafo")); const x = el[el.length - 1]; if (x) x.style.display = "none"; });
  await h.toma("c16_1"); await h.esperar(2200); await s(vis("Encontrá tus fotos más rápido"), 2600);
  await h.toma("c16_2"); await s(vis("Buscar por selfie"), 2600); await s(vis("Buscar por número o palabra clave", false), 1500);
  await h.toma("c16_3"); const imgs = p.locator("main img");
  for (const i of [3, 4, 6]) { await h.clic(imgs.nth(i)).catch(() => console.log("sin foto", i)); await h.esperar(700); }
  await foto(h, 1); const comprar = p.getByRole("button", { name: /^Comprar \d+ fotos?/ }).first();
  await s(comprar, 1800); await h.clic(comprar); await h.esperar(3000); await foto(h, 2);
  const cont = p.getByRole("button", { name: /Continuar al resumen/ }).filter({ visible: true }).first();
  await s(cont, 1600); await h.clic(cont); await h.esperar(3000);
  await h.toma("c16_4"); await s(vis("Tus datos", false), 1500);
  await h.tipear(p.getByPlaceholder("Juan Pérez"), "Lucía Fernández", 45);
  await h.tipear(p.getByPlaceholder("juan@ejemplo.com"), "lucia@ejemplo.com", 40);
  await h.tipear(p.getByPlaceholder(/Ej: 11/), "341 555 0000", 50); await foto(h, 3);
  await h.toma("c16_5"); await s(p.getByRole("button", { name: /Confirmar pedido/ }).first(), 3000); await foto(h, 4);
});
