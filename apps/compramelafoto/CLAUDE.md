# CompraMeLaFoto

## DNX Bot: mantener la guía al día
DNX Bot (`lib/bot/`) explica CLF con textos fijos: a los fotógrafos en `lib/bot/guia/` y a los compradores en `lib/bot/comprador/guia.ts`.
Cada vez que cambies cómo funciona algo (reglas, plazos, precios, pantallas, rutas, funciones nuevas):
1. actualizá `lib/bot/guia/conocimiento.ts` (y `identidad.ts` si cambia una regla del bot) y, si afecta a quien compra, `lib/bot/comprador/guia.ts`;
2. si cambiaste una ruta del panel, actualizá `lib/bot/rutas-panel.ts`, los enlaces en `lib/bot/escolar/progreso.ts` y `lib/bot/herramientas/*`; si cambiaste una página de compradores, `lib/bot/comprador/rutas.ts` y `lib/bot/comprador/pagina.ts`;
3. corré `pnpm --filter compramelafoto test:bot`.
