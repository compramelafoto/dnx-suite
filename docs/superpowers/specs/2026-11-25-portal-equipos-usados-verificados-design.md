# Portal de equipos fotográficos usados, con identidad verificada

Fecha: 25/11/2026 · Estado: revisado por un constructor; esperando aprobación de Daniel · Nombre de la marca: **por definir**
(en este documento, «el portal»).

## Para qué

Un portal web, gratuito y con marca propia, donde fotógrafos publican y compran cámaras, lentes y
accesorios usados. Lo que lo distingue de Facebook o MercadoLibre es la **seriedad**: nadie ve el
contacto de nadie ni publica nada sin haber verificado su identidad (correo, teléfono, DNI con selfie
y prueba de vida, y consulta al RENAPER), y cada cámara o lente se cruza contra el registro de
equipos robados y perdidos.

**El objetivo de negocio, por ahora, es sumar fotógrafos verificados a la base de DNX**, no ganar
dinero con el portal. La base es la de CompraMeLaFoto (CLF): quien se registra en el portal queda
registrado en CLF, y quien se verifica en el portal aparece como «Fotógrafo verificado» también en CLF.

Además, cada fotógrafo tiene un **inventario de su equipo** que se arma solo a partir de las fotos
que sube a CLF, con el que puede denunciar un robo o una pérdida, publicar a la venta y sacar un
**informe anual para su aseguradora**. Con el tiempo, cada equipo acumula un historial de dueños,
como el título de un auto.

El portal no depende de Facebook ni de Instagram: es la casa. Las redes del portal son el altavoz que
trae compradores y vendedores.

## Objetivos

1. Toda persona que ve un contacto o publica está verificada: correo, teléfono, DNI + selfie con
   prueba de vida + RENAPER. Una persona, una cuenta.
2. Inventario personal de equipo, precargado desde CLF, con estados e historial por equipo.
3. Denuncia de robo o pérdida desde el inventario, que entra al cruce que ya funciona en CLF.
4. Publicación a la venta con número de serie obligatorio (cámaras y lentes), cruce contra robados y
   sello de verificación por metadatos.
5. Registro completo de interesados: quién vio, guardó y consultó cada artículo.
6. Cierre de venta con confirmación de las dos partes, traspaso del equipo al inventario del
   comprador y calificaciones.
7. Informe de equipamiento para aseguradoras, validable con QR, con recordatorio anual.
8. Publicación automática en las redes propias del portal.
9. Gratuito para el usuario.

## No-objetivos (etapas posteriores)

- Pago dentro del portal con dinero retenido. En la etapa 1 el pago se arregla entre las partes.
- Chat interno completo (en la etapa 1 hay consulta registrada + contacto revelado, ver §7).
- TikTok (la etapa 1 publica en Instagram y Facebook).
- Precio sugerido a partir de ventas reales.
- Botón «Lo encontré» para equipos perdidos.
- Convenio con una aseguradora.
- Usuarios sin DNI argentino. *(Decisión de Claude: el RENAPER sólo valida DNI argentino; extranjeros
  quedan para después.)*

## Anti-objetivos (fracasaría aunque funcione)

- **Una verificación que se pueda engañar.** Si un estafador logra el sello, el portal pierde lo único
  que lo distingue. Por eso: proveedor con RENAPER y prueba de vida, una cuenta por DNI, revisión
  manual de lo dudoso y reverificación ante cambios sensibles.
- **Prometer más de lo que se garantiza.** «Verificado» significa *sabemos quién es*, no *la operación
  está garantizada*. Todos los textos tienen que decirlo así.
- **Exponer datos.** Ni datos del vendedor en redes ni en la ficha pública, ni coincidencias de robados
  al denunciante, ni imágenes del DNI guardadas en DNX.
- **Romper CLF.** El portal comparte la base de producción de CLF: ningún cambio puede afectar a CLF.
- **Parecer spam en redes.** Nada de una publicación por artículo: resumen diario + historias.

## Restricciones

- **Base de datos compartida con CLF producción** (Neon proyecto `compramelafoto`, rama `production`,
  `br-autumn-rain-ad18wq7y`; 797 usuarios a sept. 2026). Cambios de esquema **sólo aditivos** (tablas
  nuevas, columnas opcionales). Las migraciones de CLF se aplican a mano y con cuidado; ver el
  historial de memoria del proyecto antes de migrar.
- **Ley 25.326 de datos personales**: los datos biométricos son sensibles. Consentimiento expreso,
  inscripción de la base ante la AAIP, guardar lo mínimo. CLF ya tiene una página de consentimiento
  biométrico (`apps/compramelafoto/app/consentimiento-biometrico`) que sirve de antecedente.
- **Costo**: gratuito para el usuario; DNX paga la verificación (aprox. US$0,20 a US$1,50 por persona,
  una sola vez, a cotizar). Por eso la verificación de identidad se pide recién al querer ver un
  contacto o publicar, no al registrarse.
- No todas las cámaras graban su número de serie en el EXIF, y muchos lentes tampoco (en CLF, aprox.
  60 % de las fotos traen la serie del lente; 145 de 218 cámaras tienen serie).

## Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **A. App propia en el monorepo que comparte la base de CLF** *(elegido por Daniel)* | Los usuarios de CLF existen el día 1; el sello aparece en CLF sin sincronizar; el historial de series y las denuncias ya están en esa base; reutiliza login, `social-publisher`, `social-pieces` | Comparte base con CLF en producción: cambios de esquema con mucho cuidado |
| B. Plataforma totalmente aparte (base y usuarios propios) | Independiente, vendible sola | Arranca con cero usuarios, duplica robados y verificación, no suma a la base principal |
| C. Sección dentro de la app de CLF | La más rápida | El build de CLF ya tiene problemas de memoria; mezcla las marcas |

**Elegido: A.** Una app nueva en `apps/` con dominio y marca propios, misma base y mismo login
(`packages/auth`) que CLF.

## Diseño

### 1. Cuenta y verificación (niveles)

| Nivel | Qué se pide | Habilita |
|---|---|---|
| Registro | Correo validado por enlace | Ver catálogo, favoritos, alertas de búsqueda |
| Teléfono | Código por WhatsApp | (paso previo al siguiente) |
| Identidad | DNI frente y dorso + selfie con prueba de vida + RENAPER, vía proveedor | Ver contactos, publicar, consultar series, inventario completo, informe para aseguradora |

- **Teléfono, método gratuito**: el usuario toca un botón que abre WhatsApp con un código ya escrito y
  lo envía al número del portal; el sistema verifica que el código llegó desde el número declarado.
  Como el mensaje lo inicia el usuario, Meta no lo cobra. Alternativa paga (aprox. US$0,03) si el
  usuario no tiene WhatsApp: código enviado por nosotros.
- **Proveedor de identidad externo** que consulte el RENAPER y haga prueba de vida y comparación de
  caras. Candidatos a cotizar: Didit, MetaMap, Veriff, Truora. **No** se arma con Amazon Rekognition:
  no consulta el RENAPER.
- **Qué se guarda en DNX**: resultado, fecha, proveedor, referencia del proveedor, nombre y apellido
  según el DNI, y un **hash del número de DNI** para impedir una segunda cuenta con el mismo DNI.
  **No** se guardan imágenes del DNI ni de la cara.
- **Nombre del perfil**: sale del DNI y no se edita.
- **Revisión manual**: si el proveedor devuelve un resultado dudoso, la cuenta queda «en revisión» y
  aparece en el panel del administrador.
- **Reverificación**: cambiar correo o teléfono pide repetir la selfie.
- **Sello en CLF**: un usuario verificado muestra «Fotógrafo verificado» en su perfil de CLF.
- Consentimiento biométrico explícito antes de la verificación.

### 2. Mi equipo (inventario)

- **Precarga desde CLF**: a partir de `GearSerialSighting` (historial permanente de series de cámaras
  y lentes por fotógrafo), el inventario propone cada equipo con marca, modelo, serie, primera y
  última vez visto y cantidad de fotos. El fotógrafo confirma «es mío» o lo descarta.
- **Carga manual**: equipos sin serie en las fotos (flashes, trípodes, mochilas, filtros, drones) o que
  no pasaron por CLF; con fotos y serie si la tiene.
- **Comprobante de compra** opcional por equipo (factura o recibo).
- **Estados**: en uso, en venta, vendido, robado, perdido, recuperado.
- **Historial por equipo**: alta, uso en CLF, publicación, venta y a quién pasó, denuncias.
- **Privado**: sólo lo ve su dueño (y el administrador).

### 3. Denuncia de robo o pérdida

- Desde el inventario, con un botón sobre el equipo.
- **Robo**: comprobante de compra obligatorio, denuncia policial opcional (igual que hoy en CLF).
- **Pérdida**: comprobante opcional.
- Se crea sobre el sistema de denuncias existente de CLF (`StolenGearReport`, aprobación del
  administrador, cruce diario `/api/cron/stolen-gear-scan`, aviso sólo al administrador). Hay que
  sumar el tipo «pérdida» de forma compatible con las pantallas actuales de CLF.
- El cruce incluye también las publicaciones y los inventarios del portal.
- El denunciante nunca ve coincidencias; sólo el estado de su denuncia.
- Botón «Lo recuperé» para cerrarla.

### 4. Publicar a la venta

- Desde el inventario (datos precargados) o desde cero (crea el equipo en el inventario).
- Datos: precio, estado del equipo, fotos, accesorios incluidos, zona.
- **Número de serie obligatorio** para cámaras y lentes, con foto del número grabado en el equipo.
- **Cruce al publicar** contra denuncias activas (robo y pérdida). Si coincide: la publicación queda
  «en revisión» sin explicar el motivo al vendedor, y el administrador recibe un aviso.
- El vendedor acepta, al publicar, que el artículo pueda salir en las redes del portal.

### 5. Sello de verificación del equipo por metadatos

| Sello | Condición | Se muestra |
|---|---|---|
| **Uso verificado** | La serie publicada figura en `GearSerialSighting` bajo **el mismo usuario** | «Usado por el vendedor desde [mes/año], en [N] fotos» |
| **Foto de prueba** | El vendedor sube una foto tomada con el equipo y la serie del EXIF coincide | «Serie comprobada con foto del equipo» |
| **Sin verificar** | Ninguna de las anteriores | Sólo el sello de identidad del vendedor |

- Si la serie figura bajo **otro** usuario: **la publicación sale igual, sin el sello «Uso
  verificado»**, y el administrador recibe un aviso para revisarla cuando pueda (puede ser un equipo
  revendido, prestado, de un asistente o robado sin denunciar). Decisión de Daniel, 25/11. Nada de
  esto se muestra públicamente.
- Dos usuarios pueden tener la misma serie en su inventario; prevalece quien la recibió por un
  traspaso confirmado en el portal, y el conflicto aparece en el panel del administrador.
  *(Decisión de Claude.)*
- La lectura de EXIF reutiliza la de CLF (`photographic-equipment/process-photo-exif.ts` y
  `lib/stolen-gear/serial.ts` para normalizar).

### 6. Catálogo público

- Filtros por tipo, marca, montura, precio y zona.
- Ficha pública con fotos, sellos y precio, **sin datos del vendedor** (a lo sumo nombre de pila,
  calificación y «Identidad verificada»).
- Favoritos y **alertas de búsqueda** («avisame cuando aparezca X por menos de $Y») para usuarios
  registrados.

### 7. Contacto e interesados

- Botón «Contactar»: sólo para usuarios con identidad verificada.
- Al tocarlo: se registra la consulta, se avisa al vendedor (correo y WhatsApp) con el nombre
  verificado y la calificación del interesado, y el interesado ve el WhatsApp y el correo del
  vendedor. *(Decisión de Claude: en la etapa 1 no hay chat interno; la consulta registrada cumple
  la función de historial.)*
- **Registro de interés**: vistas de usuarios con sesión, favoritos, contactos revelados, alertas.
- El vendedor ve los interesados de cada artículo. El administrador ve todo y estadísticas.
- La política de privacidad lo informa.

### 8. Cierre de venta y traspaso

- El vendedor marca «Vendido a…» eligiendo entre quienes consultaron ese artículo.
- El comprador recibe aviso y confirma.
- Con las dos confirmaciones: el equipo pasa al inventario del comprador con su historial, y ambos
  pueden calificarse (una calificación por operación, sólo entre las partes).
- Si el comprador no confirma: la publicación se cierra, el equipo no cambia de dueño y no hay
  calificación.
- Guía de compra segura visible en cada ficha.

### 9. Consulta de número de serie

- Cualquier usuario con identidad verificada escribe una serie y recibe: «no figura con denuncia» o
  «figura con denuncia activa: no lo compres y escribinos». Nunca datos del denunciante ni de nadie.
- **Cada consulta queda registrada** con el usuario; una consulta que coincide con una denuncia avisa
  al administrador.
- Nota: el diseño de CLF del 23/11 dejó todo privado. Esto abre sólo un «sí/no» a usuarios
  verificados, aprobado por Daniel en esta conversación.

### 10. Informe para aseguradoras

- PDF con: titular verificado (nombre y DNI según la verificación), y por equipo foto, marca, modelo,
  serie, fecha y comprobante de compra, estado, sello de verificación y **valor declarado**.
- **Valor**: lo declara el fotógrafo en pesos, con su referencia en dólares; total asegurable.
- El fotógrafo elige qué equipos incluir.
- **QR de validación**: lleva a una página del portal que confirma autenticidad, fecha, que no fue
  modificado y que el titular está verificado, mostrando el contenido del informe tal como se emitió.
- **Recordatorio anual**: el fotógrafo carga la fecha de renovación de su póliza; un mes antes recibe
  aviso para revisar valores y generar el informe nuevo.
- Historial de informes emitidos.

### 11. Redes

- Cuentas propias del portal en Instagram y Facebook; nunca en la cuenta del vendedor.
- Carrusel diario automático con lo nuevo; historias de destacados y bajas de precio.
- Mezcla aprox. 4 de cada 5 piezas para compradores (producto, precio, sello) y 1 de cada 5 para
  vendedores («se vendió en X días», seguridad, «publicar es gratis»).
- Sin datos del vendedor; sólo enlace al portal.
- Reutiliza `packages/social-publisher` y `packages/social-pieces`.

### 12. Avisos (correo y WhatsApp)

Nueva consulta, confirmar compra, venta confirmada, alerta de búsqueda cumplida, verificación
aprobada/rechazada/en revisión, denuncia aprobada, recordatorio de póliza.

### 13. Panel del administrador

Verificaciones en revisión, denuncias por aprobar, coincidencias (robos, publicaciones, consultas de
serie), publicaciones en revisión, reportes de usuarios y publicaciones, bloqueo de cuentas,
estadísticas (registros, verificados, publicaciones, ventas confirmadas, interesados).

### 14. Reglas y confianza

Reportar publicación o usuario, guía de compra segura, términos y política de privacidad que digan
qué significa «verificado».

### 15. Lanzamiento

Antes de abrir al público: invitar a los fotógrafos de CLF y a los socios de SFPR a verificarse y
cargar su equipo durante dos o tres semanas, con el sello en CLF como incentivo. Las redes arrancan
cuando ya hay artículos.

## Decisiones de Claude tras la revisión del constructor (Daniel puede corregirlas)

- **Rol en CLF**: al registrarse en el portal se pregunta «¿Sos fotógrafo?». Sí → `PHOTOGRAPHER`;
  no → `CUSTOMER`. El sello «Fotógrafo verificado» en CLF sólo se muestra a `PHOTOGRAPHER`; los
  demás muestran «Identidad verificada». Un `CUSTOMER` existente puede verificarse y comprar.
- **DNI**: se guarda el hash (para una cuenta por DNI) y los **últimos 3 dígitos**. El informe para
  aseguradoras muestra el DNI enmascarado (`**.***.123`); la página del QR confirma que el titular
  está verificado. No se guarda el número completo.
- **Proveedor de identidad**: se planifica y construye con una capa intermedia propia (para poder
  cambiar de proveedor) y un proveedor simulado para desarrollo. «Dudoso» = el proveedor devuelve
  «requiere revisión» o la comparación de caras no es concluyente. El proveedor real se enchufa al
  tener la cotización.
- **Avisos de la etapa 1 sólo por correo**. WhatsApp se usa únicamente para recibir el código de
  verificación del teléfono (mensaje iniciado por el usuario, gratis). Avisos por WhatsApp, después.
- **Denuncias**: sólo cámaras y lentes entran al cruce (hace falta serie). Los demás equipos pueden
  marcarse «robado» o «perdido» en el inventario, sin cruce. La pérdida admite comprobante opcional:
  `invoiceKey` pasa a opcional sólo para pérdidas, y las pantallas de CLF deben tolerar su ausencia.
- **Etapas de entrega**: 1a = verificación, inventario, denuncias, sello en CLF e informe para
  aseguradoras (lo que se usa durante la invitación); 1b = catálogo, publicaciones, contacto,
  ventas, consulta de serie y redes. Cada etapa sale a producción por separado.
- **Pruebas**: se desarrolla contra una rama de prueba de Neon creada desde la producción de CLF;
  las migraciones se aplican a producción recién después.

## Pendiente antes de construir

- Nombre y dominio (Daniel lo define; candidatos y dominios revisados en la conversación del 25/11).
- Cotización de dos o tres proveedores de identidad.
- Número de WhatsApp que recibe los códigos de verificación. Recomendación de Claude: un número
  propio del portal, separado del bot de DNX Estudio. No frena el desarrollo (se prueba con el
  proveedor simulado), sí el lanzamiento.
- Inscripción de la base ante la AAIP y textos legales.

## Lo que queda a criterio de quien construya

Modelo de datos concreto, nombres de tablas y rutas, cómo se reutiliza el almacenamiento de
comprobantes de CLF, generación del PDF, diseño visual, y el detalle de cada pantalla.
