# Fotolibro desde WhatsApp: el estudio lo termina o el cliente lo diseña (diseño)

Fecha: 09/11/2026 · Pedido por Daniel Cuart (DNX Estudio) · Estado: **documentado, para programar cuando el bot esté en producción en el número real**

Reemplaza y amplía el borrador del 29/10/2026 (`2026-10-29-fotolibro-cliente-por-enlace-design.md`, que nunca se subió a main).

## 1. Para qué

Hoy el bot ya cotiza y vende el fotolibro (`cotizar_fotolibro` y `armar_pedido` con `fotolibro`, PR 921). Al venderlo, `atarFotolibrosAlPedido` crea el fotolibro vacío en el editor. Las fotos que manda el cliente por el chat se copian a la carpeta del trabajo (PR 917), **pero no entran al fotolibro**: alguien tiene que bajarlas y volver a subirlas.

Daniel quiere dos caminos:

- **A. El estudio lo termina.** Las fotos del cliente entran solas al fotolibro nuevo, con la medida y la tapa que pidió, y el diseñador queda listo para que Sabi o Cami lo terminen.
- **B. El cliente lo diseña.** El cliente puede diseñarlo él mismo con un asistente paso a paso: elige la plantilla temática y después diseña todo.

Éxito: ninguna foto se baja y se vuelve a subir a mano. Un cliente que quiere diseñarlo llega a un fotolibro armado en pocos minutos.

**Fuera de alcance:** imprimir solo (el estudio revisa y manda a imprimir como hoy), cambiar precios o proveedores, y los fotolibros de eventos ya contratados.

**Sería un fracaso aunque funcione:**
- que se pierda una foto del cliente;
- que se cobre una medida o una cantidad de hojas distinta de la elegida;
- que se imprima algo que el cliente no aprobó.

## 2. Camino A: el estudio lo termina (lo primero que se programa)

1. El cliente compra el fotolibro por el bot (ya existe) y manda las fotos por el chat, como foto o como documento, en una o varias tandas.
2. El bot le pregunta: **"¿Lo diseñamos nosotros o querés diseñarlo vos?"**. Si elige que lo diseñe el estudio, sigue este camino. Si elige diseñarlo él, va al camino B.
3. Cada foto del chat que el cliente indicó para el fotolibro se suma a las fotos del fotolibro:
   - se copia el original desde el R2 privado de la Bandeja;
   - se arman la vista de 2000 px y la miniatura de 400 px en el servidor;
   - se registran en `metaJson.fotolibro.fotos`, con el mismo formato que usa la subida del editor.
4. Cuando el cliente dice "listo, son todas" (o a los 30 minutos sin fotos nuevas), el sistema hace un **armado automático inicial**: reparte todas las fotos en las hojas con la plantilla por omisión de la temática del pedido.
5. En el trabajo aparece **"Fotolibro listo para diseñar: N fotos"**, con el botón **"Abrir en el diseñador"**. Sabi o Cami lo terminan en el editor de siempre.
6. Cuando el estudio lo termina, le manda al cliente una vista previa para aprobar. Primero, un enlace de solo lectura. Si pasaron más de 24 h desde el último mensaje del cliente, va con una plantilla de Meta.

## 3. Camino B: el cliente lo diseña con un asistente

Es una página por pasos, `/w/<slug>/fotolibro/<token>`, pensada para el celular, sin cuenta ni contraseña. El bot le manda el enlace. Se puede cerrar y volver.

1. **Medida y tapa**: ya vienen elegidas de la venta y se pueden cambiar mientras no esté pagado. El precio se recalcula en vivo con `cotizar`.
2. **Fotos**: ya están las que mandó por el chat. Puede sumar más ahí mismo, en calidad original, con barra de avance.
3. **Plantilla temática**: tarjetas con las temáticas del sistema (bodas, XV, bebés, viajes, familia y las demás de `lib/fotolibro/estilos`), con una vista previa de cada estilo.
4. **"Armarlo automáticamente"**: reparte todas las fotos en las hojas con esa plantilla. Ve el libro armado y lo hojea.
5. **Diseñar todo**: entra al editor para cambiar el diseño de cada hoja, ordenar las fotos, encuadrar y cambiar la tapa o los textos. Es opcional.
6. **"Enviar al estudio"**: el libro queda para revisión. El estudio lo revisa y lo manda a imprimir, y desde ese momento la página queda en solo lectura con el estado "En producción".

Si el cliente se traba o abandona, el estudio siempre puede abrir el mismo fotolibro en su diseñador y terminarlo. Eso es el camino A.

## 4. Decisiones tomadas

| # | Decisión | De quién |
|---|---|---|
| D1 | Dos caminos: el estudio lo termina (A) o el cliente lo diseña (B) | Daniel |
| D2 | En el camino A las fotos del chat entran solas al fotolibro y el diseñador queda listo para Sabi o Cami | Daniel |
| D3 | En el camino B hay un asistente paso a paso: primero la plantilla temática, después diseñar todo | Daniel |
| D4 | El camino A se programa primero: es la base del B, que reutiliza la carga de fotos y el armado automático | Mía |
| D5 | Enlace con token y sin cuenta, como el enlace de pedidos (HMAC, se guarda solo el hash, freno por IP con `pasaElFrenoDeEnlaces`) | Mía |
| D6 | El enlace sirve hasta que el estudio manda a imprimir | Mía |
| D7 | Fotos de iPhone: el selector acepta JPG, PNG y WebP. Desde el celular, el iPhone convierte solo el HEIC a JPG. En computadora, si sube un HEIC, ve un mensaje claro. Sin dependencias nuevas | Mía |
| D8 | Tope de 400 fotos por fotolibro, con los límites por foto de hoy | Mía |
| D9 | Enlaces sin pagar y sin uso: aviso a los 25 días y borrado de fotos a los 30 | Mía |

## 5. Cómo se construye (para quien lo programe)

**Lo que ya existe:**
- Venta por el bot: `cotizar_fotolibro`, `armar_pedido` con `fotolibro` y `atarFotolibrosAlPedido` (`lib/fotolibro/bot.ts`, `lib/fotolibro/venta-servidor.ts`).
- Fotos del chat en el R2 privado: `FotofficeWaMensaje.media.clave`. Se copian a la carpeta del trabajo con `CopyObject` (PR 917).
- Modelo del fotolibro: TemplateV2 y su versión, con `metaJson.fotolibro` (fotos, pliegos, estilo, tapa y venta).
- Maquetado puro: `acomodar`, `disenoDePliego`, `armarPliego`, `sumarFotos` y `generarBloques`.
- Plantillas temáticas: `ESTILOS`.
- Subida directa a R2 desde el navegador: presign, verificación y variantes, en `components/fotolibro/modo/subir-fotos.ts`.
- Generación de imágenes en el servidor: la usa Impresiones para recortar (`recortarParaImprimir`).

**Lo nuevo:**
1. **`fotosDelChatAlFotolibro(workspaceId, templateId, mensajes[])`**: copia los originales y arma vista y miniatura en el servidor. Suma las fotos con `sumarFotos` y guarda con control de revisión, igual que el guardado del editor.
2. **`repartirFotos(estado, estilo, fotosPorHoja)`**: función pura en `lib/fotolibro/modo/`. Reparte todas las fotos en orden en las hojas, con variedad de diseños por pliego. Lleva pruebas.
3. **Bot:**
   - la pregunta "¿lo diseñamos nosotros o vos?";
   - una herramienta para indicar qué fotos van al fotolibro, con los números de foto como en `armar_pedido`;
   - el cierre con "listo, son todas".
4. **Aviso en el trabajo** "Fotolibro listo para diseñar", con el botón al diseñador.
5. **Camino B:**
   - la tabla `SolicitudFotolibro` (token hash, `templateId` y estado: `ARMANDO`, `PARA_REVISAR`, `EN_PRODUCCION`, `VENCIDO`);
   - las rutas públicas por token: cotizar, subir fotos, elegir plantilla y armar, guardar y enviar;
   - la página del asistente;
   - el editor con un adaptador que guarda por token, sin herramientas internas como costos, proveedor y exportar.
6. **Arreglo previo:** `atarFotolibrosAlPedido` escribe un número en `fotolibro.fotos`, que es la lista de fotos, y podría borrarlas. Hay que revisarlo y arreglarlo con una prueba antes de cargar fotos.

**Etapas:**
- **Etapa 1 (camino A):** fotos del chat al fotolibro, armado automático inicial y aviso al estudio.
- **Etapa 2 (camino B):** el asistente con plantilla, armado y vista para hojear.
- **Etapa 3:** el editor completo por token para que el cliente diseñe todo.

## 6. Lo que queda a criterio de quien lo programe

Los textos exactos del bot y de la página, el diseño visual (con el estilo de las páginas públicas del estudio), el orden de las temáticas y cómo se muestra el avance de la subida.
