import { grabar, DIR } from "./lib.mjs";
// Clases 12 a 15 sobre el álbum demo 1272 (City tour). No se guarda ni se crea nada.
const ALB = "/dashboard/albums/1272";
const foto = (h, n) => h.p.screenshot({ path: DIR + "mira/A-" + n + ".png" });
const vis = (p, t, ex = true) => p.getByText(t, { exact: ex }).filter({ visible: true }).first();
// Pestañas del álbum: el texto exacto que está a la derecha del menú lateral (x > 290).
const tab = async (p, t) => {
  const l = p.getByText(t, { exact: true }).filter({ visible: true }); const n = await l.count();
  for (let i = 0; i < n; i++) { const bb = await l.nth(i).boundingBox(); if (bb && bb.x > 290 && bb.y < 520) return l.nth(i); }
  throw new Error("sin pestaña " + t);
};
await grabar("A", {}, async (h) => {
  const p = h.p; const s = (x, ms) => h.señalar(x, ms).catch((e) => console.log("falta", String(x).slice(0, 60)));
  // C12 · Subir las fotos
  await h.ir(ALB); await h.esperar(600);
  await h.toma("c12_1"); await s("¿Qué te recomendamos hacer ahora?", 2400); await s(vis(p, "Subir fotos del evento"), 1800);
  await s(p.getByRole("button", { name: "Subir fotos", exact: true }), 1600);
  await h.toma("c12_2"); await h.ir("/dashboard/albums/1275"); await h.esperar(800); await h.clic(await tab(p, "Contenido")); await h.esperar(1800); await foto(h, 1);
  await s(vis(p, "Tu álbum está vacío"), 1800); await s(vis(p, "Subir fotos aquí", false), 2000); await s(vis(p, "Subir carpeta", true), 2200); await foto(h, 2);
  await h.toma("c12_3"); await h.ir(ALB); await h.esperar(800); await h.clic(await tab(p, "Contenido")); await h.esperar(1800);
  await s(vis(p, "Todas las fotos"), 1500); await h.verEn(vis(p, "Foto #394425", false)).catch(() => {}); await h.esperar(2800); await foto(h, 3);
  await h.toma("c12_4"); await h.esperar(500);
  await h.toma("c12_5"); await h.arriba(); await h.esperar(1200);
  // C13 · Descuentos y packs
  await h.toma("c13_1"); await h.clic(await tab(p, "Venta")); await h.esperar(1800); await s("¿Qué querés vender en este álbum?", 2000);
  await h.toma("c13_2"); await s("Precio por foto digital (ARS)", 2600);
  await h.toma("c13_3"); await s("Descuento 5+ fotos (%)", 1800); await s("Descuento 10+ fotos (%)", 1500); await s("Descuento 20+ fotos (%)", 1500);
  await s("Vista previa — precio para el cliente", 2000);
  await h.toma("c13_4"); await h.clic(vis(p, "Packs de galería")); await h.esperar(1800); await foto(h, 4);
  await h.clic(p.getByRole("button", { name: /Agregar pack/ }).first()).catch(() => console.log("sin agregar pack")); await h.esperar(1500); await foto(h, 5);
  const modal = p.locator('[role="presentation"]').last();
  await s(modal.getByText("Todas mis fotos", { exact: true }).first(), 2600);
  await h.toma("c13_5"); await h.clic(modal.getByText("Todas mis fotos", { exact: true }).first()); await h.esperar(1600); await foto(h, 12);
  const campos = modal.locator("input").filter({ visible: true });
  for (let i = 0; i < Math.min(2, await campos.count()); i++) await s(campos.nth(i), 1500);
  await s(modal.getByRole("button", { name: /Siguiente|Continuar|Crear pack/ }).filter({ visible: true }).first(), 1800);
  await h.clic(modal.getByRole("button", { name: /^Cancelar$/ }).first()).catch(() => console.log("sin cancelar")); await h.esperar(700);
  await h.toma("c13_6"); await h.clic(vis(p, "Qué vendés")); await h.esperar(1500); await s("Estado de ventas", 1500);
  await s("Mercado Pago conectado", 1200); await s("Precio digital configurado", 1200); await s("Términos aceptados", 1200);
  await h.toma("c13_7"); await s(vis(p, "Venta activa: este álbum puede recibir compras en la galería."), 2600);
  // C14 · Selfie, dorsal y aviso de fotos nuevas
  await h.toma("c14_1"); await h.arriba(); await h.clic(await tab(p, "Configuración")); await h.esperar(2000); await foto(h, 6);
  await s("Privacidad y acceso", 1800);
  await h.toma("c14_2"); await s(vis(p, "Fotos ocultas hasta selfie", false), 3200);
  await h.toma("c14_3"); await s(vis(p, "Búsqueda por dorsal", false), 3200);
  await h.toma("c14_4"); await s(vis(p, "Protección al ampliar", false), 3000);
  await h.toma("c14_6"); await s(vis(p, "próximamente", false), 3000); await foto(h, 7);
  await h.toma("c14_7"); await h.arriba(); await h.clic(await tab(p, "Contenido")); await h.esperar(1500); await s("Interesados", 1800); await s("Lucía Fernández", 1800);
  await s(p.locator("main a[href*='wa.me'], main a[href*='whatsapp']").first(), 2200);
  // C15 · Publicar y difundir
  await h.toma("c15_1"); await h.arriba(); await h.clic(await tab(p, "Publicación")); await h.esperar(1800); await foto(h, 8);
  await h.toma("c15_2"); await s(p.getByRole("button", { name: "Copiar enlace" }).first(), 2400);
  await h.toma("c15_3"); await s(p.getByRole("button", { name: "Descargar QR" }).first(), 2400);
  await h.toma("c15_4"); await h.clic(vis(p, "Instructivos")); await h.esperar(1800); await foto(h, 9); await s("Instructivo para tus clientes", 2400);
  await h.toma("c15_5"); await s(p.getByRole("link", { name: "Ver instructivo" }).or(p.getByRole("button", { name: "Ver instructivo" })).first(), 1800);
  await h.toma("c15_6"); await s(p.getByRole("button", { name: "WhatsApp" }).or(p.getByRole("link", { name: "WhatsApp" })).first(), 1500); await s(vis(p, "Descargar PDF"), 1800);
  await h.toma("c15_7"); await s(vis(p, "Cartel A4"), 1500); await s(vis(p, "Cartel A5"), 1300); await s(vis(p, "Hoja de tarjetas A4"), 1800); await foto(h, 10);
  await h.toma("c15_8"); await h.clic(vis(p, "Visibilidad")); await h.esperar(1500); await s(vis(p, "Visible hasta", false), 2000); await s(vis(p, "Tiempo restante", false), 1800); await foto(h, 11);
});
