import { grabar } from "./lib.mjs";
// Campo del correo y «Pedir invitación» (señalado, sin tocar: tocarlo manda una invitación real).
await grabar("C06b", {}, async (h) => {
  const p = h.p;
  await h.ir("/fotografo/configuracion?tab=mercadopago"); await h.verEn("Cobro dividido al instante"); await h.esperar(500);
  await h.toma(1); await h.señalar("Correo de tu cuenta de Mercado Pago", 2400);
  await h.mover(p.locator('input[type="email"]').filter({ visible: true }).first()); await h.esperar(2200);
  await h.señalar(p.getByRole("button", { name: "Pedir invitación" }), 2800);
  await h.toma(2); await h.esperar(300);
});
