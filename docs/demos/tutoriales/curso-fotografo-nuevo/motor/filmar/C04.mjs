import { grabar } from "./lib.mjs";
// Tarjeta «Cobro dividido al instante» (toma 1 de la clase 4). No se toca «Pedir invitación».
await grabar("C04", {}, async (h) => {
  const p = h.p;
  await h.ir("/fotografo/configuracion?tab=mercadopago"); await h.esperar(300);
  await h.verEn("Cobro dividido al instante"); await h.esperar(600);
  await h.toma(1); await h.señalar("Cobro dividido al instante", 2200);
  await h.señalar("Con el cobro dividido", 4500, 6);
  await h.señalar("Correo de tu cuenta de Mercado Pago", 2200);
  await h.señalar("Si alguien paga con Mercado Pago (no con tarjeta)", 3000, 6);
  await h.toma(2); await h.esperar(300);
});
