# Créditos de las fotos de muestra de las plantillas

Todas las fotos de muestra de las plantillas del sitio son de [Unsplash](https://unsplash.com) y se
usan bajo la [Unsplash License](https://unsplash.com/license): uso libre, también comercial, sin
pedir permiso; no se pueden vender sin modificarlas ni juntarlas para armar un servicio que compita
con Unsplash. El crédito no es obligatorio, pero lo dejamos acá.

Ninguna es foto de un cliente de FOTOFFICE ni de CompraMeLaFoto. Cada dirección del CDN se verificó
con `curl -sI` (respuesta 200) el 26/10/2026; el autor sale del nombre de archivo que entrega la
descarga oficial de Unsplash. Nunca fotos de Unsplash+ (licencia paga).

**Copia en R2 (pendiente de subir):** la columna «Clave R2» es dónde va cada copia en el bucket
`fotoffice-media` (dirección pública `https://pub-2086bd02202c406a9b952f2dbfa945c9.r2.dev/<clave>`).
Para subirlas: bajar cada una con `curl "https://images.unsplash.com/<archivo>?w=1920&q=60&fm=jpg"`
(menos ancho si pasa de ~500 KB) y
`npx wrangler r2 object put fotoffice-media/<clave> --file <archivo> --content-type image/jpeg --remote`;
después cambiar `url` en `fotos.ts` por la dirección pública. El prefijo `fotoffice/plantillas/` NO
está entre los borrables de `lib/images/r2-key-policy.ts` a propósito: las comparten todos los sitios.

Para sumar una foto: agregala a `fotos.ts` y a esta tabla.

| Clave en `fotos.ts` | Qué muestra | Autor | Página en Unsplash | Archivo en Unsplash | Clave R2 | Licencia |
|---|---|---|---|---|---|---|
| `quinceTiara` | Quinceañera con vestido celeste y tiara | Quinces Perfectos | https://unsplash.com/photos/TLXLMxZMc94 | `photo-1763625639434-b11b8d8aa65f` | `fotoffice/plantillas/eventos/1.jpg` | Unsplash License |
| `quinceParque` | Quinceañera caminando por un parque | Quinces Perfectos | https://unsplash.com/photos/Y6WFOm0Bk0w | `photo-1763625639146-1d815371c289` | `fotoffice/plantillas/eventos/3.jpg` | Unsplash License |
| `novios` | Novios abrazados el día de su casamiento | Josh Batres | https://unsplash.com/photos/syhdOrkx-98 | `photo-1759271493839-be0cf1d86537` | `fotoffice/plantillas/eventos/2.jpg` | Unsplash License |
| `noviosLago` | Novios frente a un lago | Anthony Tran | https://unsplash.com/photos/fwFuglNcxNo | `photo-1646325311277-0c35409fdd57` | `fotoffice/plantillas/eventos/4.jpg` | Unsplash License |
| `brindis` | Brindis en una fiesta | Photos by Lanty | https://unsplash.com/photos/QupD32n3bGQ | `photo-1521321335080-61c4776db11b` | `fotoffice/plantillas/eventos/5.jpg` | Unsplash License |
| `noviosAtardecer` | Novios al atardecer | John Marfe Bitoon | https://unsplash.com/photos/AD3k4pko7wo | `photo-1761211488163-67bc659a8180` | `fotoffice/plantillas/eventos/6.jpg` | Unsplash License |
| `noviosMadera` | Novios junto a una pared de madera | Victoria Priessnitz | https://unsplash.com/photos/JFAPl7brL6U | `photo-1595407753234-0882f1e77954` | `fotoffice/plantillas/estudio/6.jpg` | Unsplash License |
| `noviosEscalera` | Novios en una escalera | Kari Bjorn Photography | https://unsplash.com/photos/mVovNhvgDqM | `photo-1710587385535-c406510a1c22` | `fotoffice/plantillas/retrato-editorial/3.jpg` | Unsplash License |
| `noviosCampo` | Novios en un campo | Jakob Owens | https://unsplash.com/photos/lR--zjgQRY0 | `photo-1606490208247-b65be3d94cd1` | `fotoffice/plantillas/retrato-editorial/5.jpg` | Unsplash License |
| `noviosParaguas` | Novios bajo un paraguas | Taylor Gray | https://unsplash.com/photos/ob70jH_KIXM | `photo-1647404297985-28e37069f7d3` | `fotoffice/plantillas/retrato-editorial/4.jpg` | Unsplash License |
| `parejaPared` | Novios en estudio, con fondo liso | Icons8 Team | https://unsplash.com/photos/IsRIjvgpj5Y | `photo-1544717304-14d94551b7dc` | `fotoffice/plantillas/estudio/4.jpg` | Unsplash License |
| `retratoEncaje` | Retrato de estudio con blusa de encaje | Chalo Garcia | https://unsplash.com/photos/YOUjEnOT24I | `photo-1622738010740-4b8e34702474` | `fotoffice/plantillas/estudio/1.jpg` | Unsplash License |
| `retratoAnteojos` | Retrato con anteojos de sol | Sunabi Studios | https://unsplash.com/photos/Ns6htPkdLXw | `photo-1744901581831-3ffe7d3d05f5` | `fotoffice/plantillas/estudio/2.jpg` | Unsplash License |
| `retratoSonrisa` | Retrato sonriendo a cámara | Ethan Rougon | https://unsplash.com/photos/Ri93ksQlI34 | `photo-1645963053605-25f01c33ca02` | `fotoffice/plantillas/estudio/3.jpg` | Unsplash License |
| `retratoEstudio` | Retrato en penumbra | Alwin Thomas | https://unsplash.com/photos/IRCjbZGmbso | `photo-1612248605813-7aaffaec2a87` | `fotoffice/plantillas/estudio/5.jpg` | Unsplash License |
| `retratoFondoNegro` | Retrato sentada sobre fondo negro | Denis Agati | https://unsplash.com/photos/3dL0mzyUS6M | `photo-1577091937200-29915517c0bd` | `fotoffice/plantillas/retrato-editorial/1.jpg` | Unsplash License |
| `retratoEditorial` | Retrato editorial | Ernan Solozabal | https://unsplash.com/photos/WubwJbyD7iQ | `photo-1708448903646-fc3ba372cbc7` | `fotoffice/plantillas/retrato-editorial/2.jpg` | Unsplash License |
| `calleNoche` | Calle de noche con luces de autos | Ali Shah Lakhani | https://unsplash.com/photos/CfQYiz-uexw | `photo-1635942288176-f9542e072bdd` | `fotoffice/plantillas/oscura/1.jpg` | Unsplash License |
| `ciudadAtardecer` | Calle entre edificios al atardecer | Josh Hild | https://unsplash.com/photos/TFZ7YLePsv0 | `photo-1766086892241-ffb6cc6992f6` | `fotoffice/plantillas/oscura/6.jpg` | Unsplash License |
| `calleOscura` | Calle oscura con un farol | Carson van Tol | https://unsplash.com/photos/kMYnB4oejVw | `photo-1571175136195-a0d98b925ea9` | `fotoffice/plantillas/oscura/3.jpg` | Unsplash License |
| `puenteNoche` | Ciudad de noche con un puente | Julius Carmine | https://unsplash.com/photos/o_fSNj4IAMI | `photo-1706498133899-f1cf5a6af53e` | `fotoffice/plantillas/oscura/4.jpg` | Unsplash License |
| `ciudadLuces` | Ciudad de noche | Jake Weirick | https://unsplash.com/photos/5IVa9hrd9x4 | `photo-1575090973547-6c9387c8f9e7` | `fotoffice/plantillas/oscura/5.jpg` | Unsplash License |
| `asfaltoMojado` | Ciudad de noche con el asfalto mojado | Andreas Rasmussen | https://unsplash.com/photos/6qRtgy2mpFE | `photo-1520050984229-709501d9c1ff` | `fotoffice/plantillas/oscura/2.jpg` | Unsplash License |
