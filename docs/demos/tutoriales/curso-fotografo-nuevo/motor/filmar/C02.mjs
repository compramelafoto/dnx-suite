import { grabar } from "./lib.mjs";
// Perfil y marca. No se guarda nada.
await grabar("C02", {}, async (h) => {
  const p = h.p;
  await h.ir("/fotografo/configuracion?tab=datos"); await h.esperar(500);
  await h.toma(1); await h.señalar(p.getByText("Configuración", { exact: true }).filter({ visible: true }).first(), 1400);
  await h.señalar(p.getByText("Perfil", { exact: true }).filter({ visible: true }).first(), 1400);
  await h.señalar("Datos personales", 1800); await h.señalar("Nombre del titular", 1500);
  await h.señalar("Teléfono personal o WhatsApp", 2600);
  await h.toma(2); await h.señalar("Datos de la empresa o marca", 1800); await h.señalar("Nombre de la empresa / estudio", 1800);
  await h.señalar(p.getByText("Instagram", { exact: true }).filter({ visible: true }).first(), 1500); await h.señalar(p.getByText("TikTok", { exact: true }).filter({ visible: true }).first(), 1200);
  await h.toma(3); await h.señalar("Ubicación de trabajo", 1800); await h.señalar("Distancia máxima para trabajar", 2000);
  await h.señalar(p.getByRole("button", { name: "Guardar cambios" }), 2000);
  await h.toma(4); await h.ir("/fotografo/configuracion?tab=diseno"); await h.esperar(500);
  await h.señalar("Habilitar página pública personalizada", 2400); await h.señalar("Dirección de tu página", 2000);
  await h.señalar("Vista previa del enlace", 2200);
  await h.toma(5); await h.señalar(p.getByText("Identidad visual", { exact: true }).filter({ visible: true }).first(), 1800); await h.señalar("Logo (PNG)", 1800);
  await h.señalar("Colores principales", 2200);
  await h.señalar(p.getByRole("button", { name: "Guardar preferencias y marca" }), 2200);
  await h.toma(6); await h.esperar(500);
});
