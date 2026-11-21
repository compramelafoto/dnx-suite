import { grabar, DIR } from "./lib.mjs";
// Clase 11: el resumen final del asistente. NO se toca «Crear álbum»; el álbum que se muestra al final es el vacío de la demo (1275).
await grabar("C11", {}, async (h) => {
  const p = h.p; const s = (x, ms) => h.señalar(x, ms).catch(() => console.log("falta", String(x).slice(0, 70)));
  const vis = (t, ex = true) => p.getByText(t, { exact: ex }).filter({ visible: true }).first();
  const sig = (re) => p.getByRole("button", { name: re }).filter({ visible: true }).first();
  await h.ir("/dashboard/albums/new"); await h.esperar(1500);
  await p.getByText("Evento / deporte", { exact: true }).first().click(); await sig(/^Siguiente$/).click(); await h.esperar(800);
  await p.getByPlaceholder("Ej: Casamiento Ana y Luis").fill("Maratón de Rafaela · 15 de noviembre");
  await p.getByPlaceholder(/Monumental/).fill("Plaza 25 de Mayo, Rafaela"); await h.esperar(3500);
  await p.getByText("Plaza 25 de Mayo, Microcentro").first().click(); await h.esperar(1200);
  await p.locator('input[type="date"]').first().fill("2026-11-15");
  const horas = p.locator('input[type="time"]'); await horas.nth(0).fill("08:00"); await horas.nth(1).fill("13:00");
  await sig(/^Siguiente$/).click(); await h.esperar(900);
  await p.getByRole("checkbox", { name: "Vender fotos digitales" }).check(); await h.esperar(500);
  await sig(/Siguiente: impresiones/).click(); await h.esperar(900);
  await sig(/Siguiente: seguridad/).click(); await h.esperar(900);
  await p.getByText("Público", { exact: false }).filter({ visible: true }).first().click(); await h.esperar(500);
  await sig(/Revisar y crear/).click(); await h.esperar(1500);
  await vis("Tipo de álbum:", false).scrollIntoViewIfNeeded(); await h.esperar(800);
  await h.toma("c11_1"); for (const t of ["Tipo de álbum:", "Título:", "Lugar:", "Fecha y horario:", "Fotos digitales:", "Fotos impresas:", "Seguridad:"]) await s(vis(t, false), 1300);
  await h.toma("c11_2"); await s(p.getByRole("button", { name: "Atrás" }).filter({ visible: true }).first(), 2400);
  await h.toma("c11_3"); await s(vis("Después de crear vas a poder afinar", false), 2800);
  await h.toma("c11_4"); await h.clic(p.getByRole("checkbox").filter({ visible: true }).last()); await h.esperar(600);
  await s(p.getByRole("button", { name: "Crear álbum" }).filter({ visible: true }).first(), 2600); await p.screenshot({ path: DIR + "mira/C11-a.png" });
  await h.toma("c11_5"); await h.ir("/dashboard/albums/1275"); await h.esperar(800);
  const l = p.getByText("Contenido", { exact: true }).filter({ visible: true }); for (let i = 0; i < await l.count(); i++) { const bb = await l.nth(i).boundingBox(); if (bb && bb.x > 290) { await h.clic(l.nth(i)); break; } }
  await h.esperar(1500); await s(vis("Tu álbum está vacío"), 3000);
});
