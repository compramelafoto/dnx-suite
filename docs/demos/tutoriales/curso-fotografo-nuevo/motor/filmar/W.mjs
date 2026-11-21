import { grabar, DIR } from "./lib.mjs";
// Asistente de álbum, de punta a punta, SIN tocar «Crear álbum». Marcas: c7_1… c10_4.
const foto = async (h, n) => h.p.screenshot({ path: DIR + "mira/w-" + n + ".png" });
await grabar("W", {}, async (h) => {
  const p = h.p; const m = (k) => h.toma(k);
  await h.ir("/dashboard/albums"); await h.esperar(600);
  await m("c7_1"); await h.esperar(1500); await h.señalar("Crear álbum con asistente paso a paso", 2200);
  await h.clic("Crear álbum con asistente paso a paso"); await h.esperar(2500); await foto(h, 1);
  await m("c7_2"); await h.señalar(p.getByText("Tipo", { exact: true }).filter({ visible: true }).first(), 900, 14); await h.señalar(p.getByText("Datos", { exact: true }).filter({ visible: true }).first(), 900, 14); await h.señalar("Ventas digitales", 900, 14);
  await h.señalar(p.getByText("Impresiones", { exact: true }).filter({ visible: true }).first(), 900, 14); await h.señalar("Seguridad y privacidad", 900, 14); await h.señalar(p.getByText("Listo", { exact: true }).filter({ visible: true }).first(), 900, 14);
  await m("c7_3"); await h.señalar("Evento / deporte", 2600); await h.señalar("Álbum simple", 2200); await h.señalar("Evento colaborativo", 2200);
  await m("c7_4"); await h.clic("Evento / deporte"); await h.esperar(900); await h.clic(p.getByRole("button", { name: "Siguiente", exact: true }));
  await h.esperar(1500); await foto(h, 2);
  await m("c7_5"); await h.tipear(p.getByPlaceholder("Ej: Casamiento Ana y Luis"), "Maratón de Rafaela · 15 de noviembre", 55);
  await m("c7_6"); await h.tipear(p.getByPlaceholder(/Monumental/), "Plaza 25 de Mayo, Rafaela", 60); await h.esperar(3000);
  await h.clic(p.getByText("Plaza 25 de Mayo, Microcentro").first()); await h.esperar(1800); await foto(h, 3);
  await h.señalar(p.locator(".leaflet-container").first(), 2200).catch(() => {});
  await m("c7_7");
  const fecha = p.locator('input[type="date"]').first(); await h.clic(fecha); await fecha.fill("2026-11-15"); await h.esperar(700);
  const horas = p.locator('input[type="time"]'); await h.clic(horas.nth(0)); await horas.nth(0).fill("08:00"); await h.esperar(500);
  await h.clic(horas.nth(1)); await horas.nth(1).fill("13:00"); await h.esperar(800);
  await h.clic(p.getByRole("button", { name: "Siguiente", exact: true })); await h.esperar(1800); await foto(h, 4);
  // Clase 8 · Ventas digitales
  await m("c8_1"); await h.señalar("Configuración recomendada", 2400); await h.esperar(600);
  await m("c8_2"); await h.señalar("Vender fotos digitales", 1400); await h.clic(p.getByRole("checkbox", { name: "Vender fotos digitales" })); await h.esperar(1500); await foto(h, 5);
  await m("c8_3"); const precio = p.getByLabel(/Precio por foto digital/).or(p.locator('input[type="number"]').filter({ visible: true }).first()).first();
  await h.clic(precio); await precio.press("ControlOrMeta+a"); await p.keyboard.type("5000", { delay: 120 }); await h.esperar(900);
  await h.señalar("Simulador orientativo", 3000); await foto(h, 6);
  await m("c8_4"); await h.señalar("Mostrar mensaje de espera al público", 3200);
  await m("c8_5"); await h.esperar(1500); await h.clic(p.getByRole("button", { name: /Siguiente: impresiones/ })); await h.esperar(1500); await foto(h, 7);
  // Clase 9 · Impresiones
  await m("c9_1"); await h.señalar("Ofrecer impresiones físicas", 3500);
  await m("c9_2"); await h.clic(p.getByRole("checkbox", { name: /Ofrecer impresiones físicas/ })); await h.esperar(1500); await foto(h, 8);
  await h.señalar("Origen de precios", 1800).catch(() => {}); await h.señalar("Mi lista (fotógrafo)", 1500).catch(() => {});
  await m("c9_3"); await h.clic("Laboratorio (precios del lab)").catch(() => {}); await h.esperar(1500); await foto(h, 9);
  await h.señalar(p.getByPlaceholder(/Buscar laboratorio/), 2000).catch(() => {});
  await h.clic("Mi lista (fotógrafo)").catch(() => {}); await h.esperar(800);
  await m("c9_4"); await h.señalar("Margen de ganancia sobre el precio base", 1600).catch(() => {});
  await h.tipear(p.getByPlaceholder("Ej: 35"), "35", 160); await h.esperar(1000);
  await h.señalar(p.getByText(/Simulador \(1 impresi/).filter({ visible: true }).first(), 3000).catch(() => {}); await foto(h, 10);
  await m("c9_5"); await h.señalar("¿Quién retira en laboratorio?", 2600).catch(() => {});
  await m("c9_6"); await h.señalar("Incluir versión digital con la impresa", 3000).catch(() => {}); await foto(h, 11);
  await h.clic(p.getByRole("button", { name: /Siguiente: seguridad/ })); await h.esperar(1500); await foto(h, 12);
  // Clase 10 · Seguridad y privacidad
  await m("c10_1"); await h.señalar(p.getByText("Público", { exact: false }).filter({ visible: true }).first(), 3200);
  await m("c10_2"); await h.señalar(p.getByText("No listado", { exact: false }).filter({ visible: true }).first(), 3200);
  await m("c10_3"); await h.clic(p.getByText("Privado con identificación", { exact: false }).filter({ visible: true }).first()); await h.esperar(1200);
  await h.señalar("Recomendado para eventos con menores de edad", 3000).catch(() => {}); await foto(h, 13);
  await m("c10_4"); await h.clic(p.getByRole("button", { name: /Revisar y crear/ })); await h.esperar(2500); await foto(h, 14);
});
