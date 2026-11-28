import { grabar } from "./lib.mjs";
// Inicio del panel, sin desplazar la página: la capa «Mercado Pago sin conectar» tapa la tarjeta del país.
await grabar("C01b", {}, async (h) => {
  const p = h.p;
  await h.ir("/fotografo/dashboard"); await h.esperar(400);
  await h.toma(7); await h.esperar(1500);
  await p.mouse.move(700, 330, { steps: 30 }); await h.esperar(2200);
  await p.mouse.move(370, 375, { steps: 25 }); await h.esperar(2600);
  await p.mouse.move(1180, 175, { steps: 35 }); await h.esperar(2500);
});
