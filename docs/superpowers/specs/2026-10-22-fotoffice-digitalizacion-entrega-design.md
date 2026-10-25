# FOTOFFICE — Digitalización · Partes 3 y 4: Entrega, cobro, otros negocios y apagado

Fecha: 2026-10-22 · Estado: decisiones tomadas por el controlador con autorización explícita de
Daniel ("avanzá con todas las etapas restantes hasta que estén terminadas en producción"), sobre
las decisiones D11–D20 del diseño de la parte 1.

Base existente (relevada el 22/10 en `origin/main`):
- Pedidos con seña, saldo, plan de cuotas y página pública `/w/[slug]/pedido/[token]`, que cobra con
  Mercado Pago y muestra datos de transferencia.
- Cobros en Caja.
- Correos por Resend (`sendTransactionalEmail`).
- Envío por km en Impresiones: Nominatim, coordenadas del estudio en el perfil de precios y
  `cotizarEnvio`.
- Comisión de plataforma: `WorkspaceModuleFee`, `getPlatformFeeBps` (default 500 bps) y el
  `WorkspaceFeeLedgerEntry` con DEVENGADO/RETENIDO.

## Decisiones

| # | Decisión |
|---|---|
| E1 | **Entrega por pedido:** tabla nueva `DigitalizacionEntrega` (una por pedido). Se crea cuando la primera grabación de un trabajo de ese pedido queda LISTA. Guarda `envioAutomatico` (por defecto **sí**), `token` (hash), `enviadoAt`, `videosVencen` (enviadoAt + 30 días), `cassettesVencen` (enviadoAt + 30 días), los recordatorios ya enviados y `extensiones`. |
| E2 | **Cuándo sale el correo:** cuando todas las grabaciones de los trabajos del pedido están LISTA o SIN_IMAGEN y al menos una está LISTA. Si `envioAutomatico`, lo manda el mismo cron que mira la cola. Si no, la lista muestra "Listo para enviar" con el botón **"Enviar al cliente"** (D12). |
| E3 | **Correo "Tus videos están listos":** cantidad de videos y la duración de cada uno; el saldo del pedido con el enlace a la página del pedido (pagar por Mercado Pago o transferencia); el enlace a la página de videos; "3 descargas por video"; "disponibles hasta dd/mm"; "Retirá tus cassettes antes del dd/mm: después los descartamos porque no tenemos espacio para guardarlos" (D16); y "¿Querés que te los llevemos?" con el enlace al pedido de envío. |
| E4 | **Página pública de videos** `/w/[slug]/videos/[token]`: muestra cada video con título y duración, "Ver", "Descargar (quedan N)", "Comprar otra descarga", "Extender 30 días" y "Pedir envío de los cassettes". **Con saldo pendiente**, los videos no se ven ni se descargan: aparece "Pagá el saldo para habilitar tus videos" con el botón al pedido. |
| E5 | **Descargas contadas** (D14): una ruta del servidor valida el token, el pago, el vencimiento y el cupo, cuenta la descarga y redirige a la URL firmada (attachment, 24 h). Una descarga reanudada usa la misma URL y no vuelve a contar. Cupo por video: **3 + descargas extra pagadas**. |
| E6 | **Cargo extra en un pedido** (falta en FOTOFFICE). Función nueva `agregarCargoAlPedido(pedidoId, concepto, montoArs, origen)`, dentro de `bloquearPedido`: suma un ítem, sube `totalArs` y crea una cuota nueva. Se registra en `DigitalizacionCargo` (tipo `DESCARGA_EXTRA` / `EXTENSION` / `ENVIO`, `cuotaId`, `estado`, el video si corresponde). Se cobra en la **misma página del pedido**, con Mercado Pago o transferencia. Cuando esa cuota queda paga (al acreditar un cobro), el cargo se aplica: +1 descarga, +30 días o envío confirmado. |
| E7 | **Precios:** la descarga extra cuesta **el 25 % del precio del trabajo del video** (precio unitario del ítem del pedido); la extensión, **el 50 % del total original del pedido** sin cargos extra (D14, D15). Mínimo de 100 pesos. |
| E8 | **Recordatorios y vencimiento** (D15): un cron diario a las 10:00 (hora argentina) manda "tus videos se borran en 10 / 5 / 1 días", con el botón para extender. Al vencer, borra los MP4 de R2 y marca `videoBorradoAt`. La página dice "Los videos se borraron el dd/mm". |
| E9 | **Envío de cassettes** (D17): en la página de videos se busca la dirección con el buscador que ya existe (Nominatim). La distancia es la línea recta desde las coordenadas del estudio × 1,3, igual que Impresiones (en lugar de Google Maps: no hace falta clave nueva). El precio sale de las **franjas de km** configuradas por negocio en `DigitalizacionAjustes.enviosFranjas` (`[{ hastaKm, precioArs }]`); pasada la última franja, sin franjas o sin coordenadas del estudio, queda **"A coordinar"**. La dirección se guarda en la ficha del cliente (`Client.address`/`city` y el perfil de provincia y código postal). Se crea el cargo de envío (si hay precio) y una **nota en el trabajo** para el equipo. |
| E10 | **Ver video sin esperas** (se vio en la primera cinta real: saltar a la hora 1 de un MP4 fragmentado de 7 GB exige bajarlo hasta ahí). El worker genera además una **versión para mirar en HLS** (720p, ~2 Mbps, segmentos de 6 s), que se sube por partes mientras convierte. "Ver" usa HLS (nativo en Safari, `hls.js` en Chrome); "Descargar" sigue siendo el MP4 Full HD. El HLS se borra junto con el MP4. |
| E11 | **Configuración** en la lista de Digitalización (MANAGE): minutos sin imagen (ya existe), franjas de envío y "Enviar al cliente automáticamente al terminar", que es el valor por defecto de cada entrega nueva. |
| F1 | **Comisión 5 % para otros negocios** (D18): en los pedidos con `DigitalizacionEntrega`, con `getPlatformFeeBps(ws, "digitalizacion")`. Con Mercado Pago va como `marketplace_fee` y se registra como RETENIDO al acreditar. Con cobro manual o transferencia se registra DEVENGADO (deuda) en el mismo libro de comisiones, con una columna nueva `pedidoCobroId`. Se descuenta de lo que se retenga después, igual que con las cuotas de la SFPR. DNX es la plataforma: su `WorkspaceModuleFee` de digitalización queda en 0. |
| F2 | **Marca propia por negocio:** ya está en el worker (logo, nombre y WhatsApp de `FotofficeWorkspaceBranding`). No hay cambios. |
| F3 | **Ayudante para apagar la PC** (D19): un script PowerShell que se instala una vez desde la estación (botón "Descargar ayudante" con las instrucciones). Escucha **sólo en 127.0.0.1:47231**, acepta sólo el `Origin` `https://fotoffice.com` (y `www`), responde la preflight de red privada de Chrome y exige un código de emparejamiento que el instalador muestra y la estación guarda. La estación lo detecta y muestra la casilla "Apagar la computadora al terminar". Cuando todo subió, aparece un aviso de 60 s con "Cancelar" y después pide `shutdown /s /t 0`. Se inicia solo al iniciar sesión en Windows (tarea programada). |

## Fuera de alcance

Los pagos que lleguen por transferencia los sigue marcando una persona con "Verificar pago", como
hoy: FOTOFFICE no concilia transferencias solo. La cotización de PedidosYa queda para más adelante.
