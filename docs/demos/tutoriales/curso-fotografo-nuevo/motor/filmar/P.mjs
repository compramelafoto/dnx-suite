import { grabar, DIR } from "./lib.mjs";
// Pack «Todas mis fotos»: se recorre el formulario hasta el precio y el nombre. NO se toca «Crear pack».
await grabar("P", {}, async (h) => {
  const p = h.p; const s = (x, ms) => h.señalar(x, ms).catch(() => console.log("falta", String(x).slice(0, 70)));
  await h.ir("/dashboard/albums/1272"); await h.esperar(600);
  const l = p.getByText("Venta", { exact: true }).filter({ visible: true }); for (let i = 0; i < await l.count(); i++) { const bb = await l.nth(i).boundingBox(); if (bb && bb.x > 290 && bb.y < 520) { await l.nth(i).click(); break; } }
  await h.esperar(1500); await p.getByText("Packs de galería", { exact: true }).filter({ visible: true }).first().click(); await h.esperar(1500);
  await p.getByRole("button", { name: /Agregar pack/ }).first().click(); await h.esperar(1500);
  const modal = p.locator('[role="presentation"]').last();
  await h.toma(1); await h.clic(modal.getByRole("button", { name: /Todas mis fotos/ }).first()); await h.esperar(1500);
  await p.screenshot({ path: DIR + "mira/P-1.png" });
  for (let paso = 0; paso < 3; paso++) {
    const campos = modal.locator("input:not([type=checkbox]):not([type=radio]), select").filter({ visible: true });
    for (let i = 0; i < Math.min(3, await campos.count()); i++) await s(campos.nth(i), 1300);
    const sig = modal.getByRole("button", { name: /^Siguiente/ }).filter({ visible: true }).first();
    if (!(await sig.count())) break;
    await h.clic(sig); await h.esperar(1300); await p.screenshot({ path: DIR + `mira/P-${paso + 2}.png` });
  }
  await s(modal.getByRole("button", { name: /Crear pack|Guardar/ }).filter({ visible: true }).first(), 2400);
  await h.toma(2);
  await h.clic(modal.getByRole("button", { name: /^Cancelar$/ }).first()).catch(() => {});
});
