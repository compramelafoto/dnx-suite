# CompraMeLaFoto

## DNX Bot: mantener la guía al día
DNX Bot (`lib/bot/`) explica CLF a los fotógrafos con un texto fijo en `lib/bot/guia/`.
Cada vez que cambies cómo funciona algo (reglas, plazos, precios, pantallas, rutas del panel, funciones nuevas):
1. actualizá `lib/bot/guia/conocimiento.ts` (y `identidad.ts` si cambia una regla del bot);
2. si cambiaste una ruta del panel, actualizá los enlaces en `lib/bot/escolar/progreso.ts` y `lib/bot/herramientas/*`;
3. corré `pnpm --filter compramelafoto test:bot`.
