// Atajos globales de la guía de las demos: Chrome los escucha aunque la ventana activa sea otra
// (Meet, otra aplicación). Manda a la pestaña de la demo la misma tecla que el presentador
// inalámbrico (Avance/Retroceso de página); la guía ya sabe qué hacer con ella.

const SITIOS = ["https://compramelafoto.com/*", "https://www.compramelafoto.com/*", "http://localhost/*"];

async function pestanaDeLaDemo() {
  const pestanas = await chrome.tabs.query({ url: SITIOS });
  if (pestanas.length === 0) return null;
  // La guía en otra ventana, si está abierta: siempre es de la demo.
  const guia = pestanas.find((p) => p.url && new URL(p.url).pathname === "/demo/guia");
  if (guia) return guia;
  // Si no, la pestaña visible de la ventana usada más recientemente.
  const visibles = pestanas.filter((p) => p.active);
  const ultima = await chrome.windows.getLastFocused().catch(() => null);
  return visibles.find((p) => ultima && p.windowId === ultima.id) ?? visibles[0] ?? pestanas[0];
}

chrome.commands.onCommand.addListener(async (comando) => {
  const tecla = comando === "avanzar" ? "PageDown" : comando === "retroceder" ? "PageUp" : null;
  if (!tecla) return;
  const pestana = await pestanaDeLaDemo();
  if (!pestana?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: pestana.id },
    args: [tecla],
    func: (key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
  });
});
