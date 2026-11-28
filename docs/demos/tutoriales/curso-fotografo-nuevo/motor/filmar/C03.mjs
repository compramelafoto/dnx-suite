import { grabar } from "./lib.mjs";
// Mercado Pago (la cuenta demo ya está conectada). No se toca «Desconectar».
await grabar("C03", {}, async (h) => {
  const p = h.p;
  await h.ir("/fotografo/configuracion?tab=mercadopago"); await h.esperar(500);
  await h.toma(2); await h.esperar(500);
  await h.señalar(p.getByText("Ventas", { exact: true }).filter({ visible: true }).first(), 1500);
  await h.señalar(p.getByRole("link", { name: "Mercado Pago", exact: true }).filter({ visible: true }).first(), 2000);
  await h.señalar(p.getByText("Mercado Pago", { exact: true }).filter({ visible: true }).nth(1), 1500).catch(() => {});
  await h.toma(5); await h.señalar("Conectado con Mercado Pago", 2600); await h.señalar("Conectado el:", 2200);
  await h.toma(7); await h.señalar("Cobro dividido al instante", 2600); await h.esperar(800);
  await h.toma(8); await h.esperar(300);
});
