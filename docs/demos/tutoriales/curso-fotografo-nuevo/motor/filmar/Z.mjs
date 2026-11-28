import { grabar, DIR } from "./lib.mjs";
// Foto ampliada en el álbum público: muestra la protección (marca de agua dinámica).
await grabar("Z", {}, async (h) => {
  const p = h.p;
  await h.ir("/a/city-tour-caminito-y-san-telmo---15-de-noviembre-b0fe13e8"); await h.esperar(1500);
  await p.evaluate(() => { const el = [...document.querySelectorAll("div,section,aside")].filter(e => e.innerText && e.innerText.trim().startsWith("Vista de fotógrafo")); const x = el[el.length - 1]; if (x) x.style.display = "none"; });
  const lupa = p.locator('button[aria-label*="mpliar"], button[aria-label*="Ver"], button[title*="mpliar"]').filter({ visible: true });
  console.log("lupas", await lupa.count(), await p.evaluate(() => [...document.querySelectorAll("button")].map(b => b.getAttribute("aria-label")).filter(Boolean).slice(0, 15).join(" | ")));
  await h.verEn(p.locator("main img").nth(4)); await h.esperar(500);
  const l = (await lupa.count()) ? lupa.nth(2) : p.locator("main img").nth(4);
  await h.toma(1); await h.clic(l); await h.esperar(2000); await p.screenshot({ path: DIR + "mira/Z-1.png" });
  await p.mouse.move(640, 360, { steps: 20 }); await h.esperar(5000); await p.screenshot({ path: DIR + "mira/Z-2.png" });
  await h.toma(2);
});
