# Conexión FOTOFFICE ↔ CompraMeLaFoto — diseño

**Fecha:** 07/11/2026 · **Estado:** borrador para aprobar · **Pidió:** Daniel Cuart

## 1. Para qué es

Hoy un trabajo que se vende por CompraMeLaFoto (CLF) queda partido en dos. Por ejemplo, la Colación de 7° de la Escuela José Ingenieros:
- En FOTOFFICE están el cliente, el pedido y el contrato. El pedido 2026-0030 figura en **$0**, porque cada familia paga en la preventa.
- En CLF están la preventa y el dinero (álbum 1283).
- El enlace de la preventa se pegó a mano en el contrato.

Lo que se busca:
1. **Cualquier fotógrafo** que use las dos plataformas ve en FOTOFFICE lo que realmente cobró por CLF, venta por venta. Cada venta está verificada contra su cuenta de Mercado Pago y separada del dinero del mostrador.
2. **Daniel**, sólo con su cuenta dnxfotografia@gmail.com, ve en FOTOFFICE el dinero limpio que le dejan las comisiones de CLF y de FOTOFFICE (y más adelante las del resto de las plataformas), conciliado con su cuenta de Mercado Pago.
3. Un pedido o un proyecto de FOTOFFICE sabe a qué álbum de CLF corresponde y puede poner ese enlace en el contrato.

**Cuándo sale bien:** el fotógrafo abre FOTOFFICE y, sin cuentas a mano, ve «este mes cobré $X por CLF». La cifra coincide peso por peso con lo que entró a su Mercado Pago. La Caja del mostrador no cambia nada.

**Cuándo sale mal, aunque funcione:**
- Una cifra en FOTOFFICE no coincide con Mercado Pago.
- Aparece en FOTOFFICE un nombre, correo o teléfono de una familia, o el nombre de un chico.
- Alguien que no sea Daniel con su cuenta dnxfotografia@gmail.com (Sabina, Camila, un usuario futuro, incluso un super admin) ve los ingresos de la plataforma.
- La Caja o los Informes de resultados se inflan con ventas de CLF sin que nadie lo haya decidido.

## 2. Hechos de partida (verificados el 07/11/2026)

- **Dos bases, dos padrones de usuarios.**
  - FOTOFFICE vive en la rama Neon `development` (`br-old-rain-adwthzng`) y CLF en `production` (`br-autumn-rain-ad18wq7y`), las dos del proyecto `divine-hall-10689679`.
  - El esquema Prisma es el mismo archivo para las dos, pero los datos no: cuart.daniel@gmail.com es el usuario 2 en FOTOFFICE y el 1 en CLF.
  - **Ninguna app lee la base de la otra para esta función. Se habla por API.**
- **Cómo cobra CLF.** Usa Checkout Pro con el token de Mercado Pago del que cobra (normalmente el fotógrafo) más `marketplace_fee`, que es la comisión de plataforma, y queda en la cuenta de la aplicación.
  - `external_reference` es el id del pedido (`String(orderId)`).
  - `Order.mpPaymentId` guarda el id del pago.
  - `Order.totalCents` está en **pesos** (no en centavos) y es lo que pagó la familia.
  - `Order.platformCommissionCents` es la comisión.
  - Si hay evento con organizador, el neto real del fotógrafo está en `EventOrganizerCommission.photographerNetAmount`.
- **Qué no guarda CLF.** No guarda `fee_details`, `net_received_amount` ni la fecha de acreditación.
- **Reintegros en CLF.** El webhook pasa el pedido a `REFUNDED` (también en contracargos) y deja el motivo en `OrderAuditLog`. Los reintegros **parciales no se distinguen**.
- **Copias que duplican dinero.** Los pedidos mixtos crean una copia en `PrintOrder` con la etiqueta `ALBUM_ORDER:{id}`. La preventa crea además un `PreCompraOrder` (ahí `totalCents` sí está en centavos). **Sólo cuenta `Order`.**
- **Mercado Pago en FOTOFFICE.** La cuenta conectada del espacio está en `DnxPaymentAccount.providerUserId`, con la credencial cifrada en `DnxEncryptedCredential`. DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`) tiene conectada la cuenta **97484805**, la misma `mpUserId` del usuario 79 de CLF.
- **Volumen.** El usuario 79 tiene hoy 30 ventas pagadas: $625.250 pagados por las familias y $80.250 de comisión de plataforma.
- **Super admin.** En FOTOFFICE el único super admin es cuart.daniel@gmail.com. A dnxfotografia@gmail.com se le quitó el 25/09 por pedido de Daniel («el super admin es sólo super admin»).

## 3. Etapas

| Etapa | Qué entrega | Toca CLF |
|---|---|---|
| **1. Vínculo con el álbum** | El pedido o proyecto queda unido a un álbum de CLF; el enlace se ve en las fichas; variable `[preventa_enlace]` en contratos | Una ruta pública chica de sólo lectura |
| **2. Ventas CLF del fotógrafo** | Conexión de cuentas con consentimiento; libro «Ventas CLF» verificado contra Mercado Pago; reintegros | Sí: pantalla de autorización y API de ventas |
| **3. Ingresos de la plataforma** | Dinero limpio de las comisiones de CLF y FOTOFFICE, conciliado con Mercado Pago, sólo para la cuenta de Daniel | Sí: API de comisiones con llave de plataforma |

Cada etapa sale a producción sola y tiene su propio plan. La 1 no depende de la 2.

---

## 4. Etapa 1 — Vincular un pedido o proyecto con su álbum de CLF

**Comportamiento**
- En la ficha del **pedido** aparece la tarjeta «CompraMeLaFoto». Tiene un campo para pegar el enlace del álbum o de la preventa, por ejemplo `https://www.compramelafoto.com/album/<slug>/preventa`.
- FOTOFFICE valida el enlace:
  - Dominio `compramelafoto.com`, con o sin `www`.
  - Extrae el `slug`.
  - Acepta también `/album/<slug>` y `/a/<id>`.
  - Consulta en CLF una ruta pública **nueva y chica**, `GET /api/public/album/[slug]/resumen`, que devuelve sólo `{ id, titulo, slug, tienePreventa, preventaCierraEl }`. La fecha de cierre es la del pack que cierra último.
    - Hace falta una ruta nueva porque no existe ninguna que sirva. La más parecida, `precompra`, responde 404 cuando la preventa está cerrada.
    - Esta ruta no devuelve datos de compradores ni de alumnos.
  - Si el álbum no existe, no se guarda y se muestra el aviso.
  - Una preventa cerrada **sí** se puede vincular.
- La tarjeta muestra el título, el botón «Abrir en CLF», «Copiar enlace de la preventa» y «Quitar vínculo».
- Un pedido tiene **a lo sumo un** álbum vinculado. **Es mi decisión:** alcanza para los casos reales y simplifica la variable.
- La ficha del **proyecto** muestra, sólo para leer, el vínculo de su pedido. Un proyecto puede tener vínculo propio **únicamente si no tiene pedido**. Así nunca hay dos álbumes en pugna, aunque un pedido tenga varios proyectos.
- **Variable nueva de contrato: `[preventa_enlace]`**, en el grupo «Pedido». Sale siempre del vínculo del pedido (los contratos siempre salen de un pedido).
  - Si el álbum tiene o tuvo preventa, pone `https://www.compramelafoto.com/album/<slug>/preventa`, la forma pegada hoy en el contrato 2026-0001. En CLF esa dirección lleva a la página del álbum.
  - Si no, pone `https://www.compramelafoto.com/album/<slug>`.
  - Si no hay vínculo, queda vacía, así que se puede usar `[si:preventa_enlace]…[/si]`.
- La misma variable entra al catálogo de **plantillas de mensajes** (`lib/plantillas/variables.ts`), para mandar el enlace por WhatsApp o correo desde el pedido.

**Datos.** Tabla nueva `FotofficeClfVinculo`:
- Columnas: `id`, `workspaceId`, `pedidoId?`, `proyectoId?`, `albumSlug`, `albumUrl`, `preventaUrl?`, `tituloSnapshot`, `preventaCierraEl?`, `clfAlbumId?`, `creadoPor`, fechas.
- Índice único por `pedidoId` y otro por `proyectoId`.
- `clfAlbumId` queda vacío en la etapa 1 y se completa en la 2.

**Permisos.** Ver y editar el vínculo sigue los permisos del módulo Pedidos o Proyectos (`operar`). No muestra dinero.

**En esta etapa no se hace:**
- No se verifica que el álbum sea del mismo fotógrafo, porque todavía no hay conexión de cuentas. Cualquier enlace válido de CLF se acepta.
- No se muestran ventas.

**Caso real para probar:** pedido 2026-0030 con el álbum 1283. Una plantilla de contrato con `[preventa_enlace]` tiene que dar el mismo enlace que hoy está pegado a mano en la cláusula TERCERA. El contrato 2026-0001 ya está firmado y **no se toca**.

---

## 5. Etapa 2 — Ventas CLF del fotógrafo

### 5.1 Conexión de cuentas con consentimiento

Las bases no comparten usuarios, así que la conexión **nunca se arma comparando correos**: la autoriza el fotógrafo, logueado en las dos plataformas. El circuito copia el de «Conectar con Mercado Pago»:

1. En FOTOFFICE, en **Configuración → Integraciones → CompraMeLaFoto**, el dueño o admin del espacio toca «Conectar».
2. FOTOFFICE guarda un `state` de un solo uso (vence a los 10 minutos) y redirige a CLF: `https://www.compramelafoto.com/conectar/fotoffice?state=…&espacio=<nombre>`.
3. En CLF, con la sesión de CLF (si no la tiene, primero el login de CLF), aparece una pantalla de autorización:
   - «**DNX Estudio (FOTOFFICE)** quiere ver tus ventas de CompraMeLaFoto: álbum, pack, fecha, monto e id de pago de Mercado Pago. **No va a ver datos de compradores ni de alumnos.**»
   - Botones «Autorizar» y «Cancelar».
4. Al autorizar, CLF crea un código de un solo uso (vence a los 2 minutos) y vuelve a FOTOFFICE: `/api/integraciones/clf/callback?code=…&state=…`.
5. FOTOFFICE canjea el código **de servidor a servidor**, con un secreto compartido entre las dos apps (`DNX_CLF_FOTOFFICE_CLIENT_SECRET`). CLF responde con una llave de acceso.
   - CLF guarda sólo el **hash** de la llave, igual que con `PackAccessToken` y `FotofficeDispositivo`.
   - FOTOFFICE la guarda **cifrada** en `WorkspaceIntegration` con la clave `compramelafoto`, usando `saveIntegration`.
   - Junto con la llave se guarda el id del usuario de CLF y su `mpUserId` en `accountExternalId`.
6. **Control de cuenta de Mercado Pago:**
   - Si el `mpUserId` de CLF es igual al `providerUserId` de la cuenta conectada en Configuración → Cobros, la conexión queda «Verificada».
   - Si son distintos, o si falta alguno de los dos, la conexión queda hecha pero en estado «**Cuentas de Mercado Pago distintas**», con una explicación. Las ventas se ven, pero ninguna sale como validada. **Es mi decisión** dejarla pasar en lugar de bloquearla: así el fotógrafo ve el problema y lo arregla, en vez de quedarse sin nada.

**Desconectar.** Se puede desde los dos lados:
- En FOTOFFICE, desde la misma pantalla. Se borra la llave guardada y se avisa a CLF para que la revoque.
- En CLF, en una lista nueva «Apps conectadas» dentro de la configuración del fotógrafo.
- Las ventas ya importadas **se conservan** y quedan marcadas «conexión cerrada».

**Alcances:**
- Un espacio de FOTOFFICE se conecta con **una** cuenta de CLF.
- Una cuenta de CLF puede autorizar a más de un espacio, y cada uno tiene su propia llave.
- **Es mi decisión:** el caso de un fotógrafo con dos cuentas de CLF no se cubre ahora.

**Álbumes compartidos.** Si el fotógrafo es colaborador y no dueño (`AlbumCollaborator`), en esta etapa **no** se incluyen sus ventas: sólo los álbumes donde `Album.userId` es la cuenta conectada. Queda anotado para después.

### 5.2 De dónde salen las ventas: API de CLF

Ruta nueva en CLF: `GET /api/integraciones/fotoffice/v1/ventas?cursor=…`, con la llave como `Authorization: Bearer`.

**Qué devuelve**
- Pedidos `Order` de los álbumes del usuario, con `isTest = false` y `checkoutPaymentSource = MERCADO_PAGO`.
- Están en estado `PAID`, o en `REFUNDED`/`FAILED` si alguna vez estuvieron pagados.
- Ordenados por `updatedAt` y paginados con cursor, de a 200. Un pedido que cambia (por ejemplo, se reintegra) vuelve a aparecer.

**Cada venta trae**

| Campo | De dónde sale |
|---|---|
| `orderId` | `Order.id` |
| `mpPaymentId` | `Order.mpPaymentId` |
| `estado` | `PAID`, `REFUNDED` o `FAILED`, más `motivo` (`reintegro`, `contracargo`, `rechazo`) sacado de `OrderAuditLog` |
| `pagadoEl` | fecha del evento `PAYMENT_APPROVED` en `OrderAuditLog` |
| `album` | `{ id, titulo, slug }` |
| `detalle` | líneas sin datos personales: «Pack 5 digitales + 5 copias × 1», «Foto digital × 3» |
| `pagoFamilia` | `totalCents` (pesos) |
| `comisionPlataforma` | `platformCommissionCents`, **sin** el descuento de referidos (se calcula aparte) |
| `descuentoReferidos` | `referralFeeDiscountCents` (en pesos, aunque el comentario diga centavos) |
| `comisionOrganizador` | lo retenido para el organizador, si hay evento |
| `retenidoEsperadoMp` | lo que CLF le mandó a Mercado Pago como `marketplace_fee`: `comisionPlataforma − descuentoReferidos + comisionOrganizador` (si cobra el organizador, sin la retención) |
| `netoFotografo` | `photographerNetAmount` si hay evento; si no, `totalCents − retenidoEsperadoMp` |
| `cobrador` | `PHOTOGRAPHER` u `ORGANIZER`, y su `mpUserId` |

**Qué NO devuelve nunca:** el nombre, correo, teléfono o usuario del comprador; datos del alumno (nombre, curso, división, notas, selfies); direcciones de retiro; las fotos; los `PreCompraOrder`; ni las copias `PrintOrder` con `ALBUM_ORDER:*`.

La lista blanca de campos va en una función pura con prueba propia: si alguien agrega un campo con datos personales, la prueba falla.

**Cuándo se trae.** Un cron de FOTOFFICE cada 15 minutos pide lo nuevo desde el último cursor, guardado en `WorkspaceIntegration.syncCursor`. La pantalla tiene además el botón «Actualizar ahora». **Es mi decisión** traer las ventas así (FOTOFFICE pregunta) en vez de que CLF las empuje: es más simple, no suma un webhook nuevo y alcanza con «a medida que entra» con 15 minutos de demora.

### 5.3 Validación contra Mercado Pago

La cifra que manda es **la de Mercado Pago, no la de CLF**. Por cada venta nueva o que cambió, FOTOFFICE consulta `GET /v1/payments/{mpPaymentId}` **con la credencial de Mercado Pago del propio espacio** (`resolveWorkspaceCollector`). Si el pago se cobró en la cuenta del fotógrafo, esa credencial lo puede leer.

Con esa consulta se guarda:
- `transaction_amount`: lo que pagó la familia.
- `fee_details`: por un lado la comisión de plataforma (`application_fee`), por otro la de Mercado Pago (`mercadopago_fee`).
- `net_received_amount`: lo que entró a la cuenta.
- `status`, `transaction_amount_refunded`, `date_approved`, `money_release_date` y `external_reference`.

**Estados de cada venta en FOTOFFICE:**

| Estado | Cuándo |
|---|---|
| **Validada** | El pago existe en la cuenta del espacio, `external_reference` es igual a `orderId`, el monto coincide con `pagoFamilia` y el `application_fee` coincide con `retenidoEsperadoMp` (tolerancia: $1 por redondeo) |
| **Con diferencia** | El pago existe, pero algún monto no coincide. Se muestran las dos cifras |
| **No está en tu Mercado Pago** | El pago no se puede leer con la cuenta del espacio (lo cobró el organizador, otra cuenta o la conexión de Cobros está caída). No suma a «Cobrado» |
| **Reintegrada** / **Reintegro parcial** | Mercado Pago informa `refunded`, `charged_back` o un `transaction_amount_refunded` mayor que 0 |

**Primer paso obligatorio de la etapa 2: prueba de factibilidad, antes de construir la validación.** Con la credencial de Cobros de DNX Estudio, hay que leer 2 o 3 pagos reales del álbum 1283 y anotar qué devuelve Mercado Pago. Hay dos dudas:
- **(a) Si se puede leer el pago.** Esa credencial es de la aplicación FOTOFFICE y el pago se creó con la de CLF. Lo esperable es que funcione, porque el token es del usuario, pero hay que confirmarlo.
- **(b) Si aparece `application_fee` cuando la cuenta se cobra a sí misma.** En DNX, la 97484805 es a la vez la que vende y la dueña de la aplicación.

Lo que resulte cambia esto:
- Si no aparece `application_fee`, esas ventas se validan sólo por monto pagado y `external_reference`, y quedan como **«Validada (cuenta propia)»**. La comisión mostrada sale de CLF.
- Si no se puede leer el pago, la validación pasa a usar el token que el fotógrafo ya tiene en CLF, leído del lado de CLF y devuelto en la API. Es peor, porque CLF se valida a sí mismo, y en ese caso hay que avisarle a Daniel antes de seguir.
- Para probar la validación completa hace falta un segundo fotógrafo real con las dos plataformas conectadas. Lo elige quien construya, con aviso a Daniel.

**Qué cuenta como «lo que cobraste».** Hay dos columnas y las dos están a la vista:
- **Tu precio:** lo que pagó la familia menos la comisión de plataforma y la del organizador. Coincide con «el precio que fijaste».
- **Acreditado en Mercado Pago:** `net_received_amount`, que además descuenta la comisión de Mercado Pago. **Es la cifra principal del total** porque es la que coincide con la cuenta. **Es mi decisión.**

**Descuentos.** CLF no tiene cupones para compradores. El único descuento es el de referidos, que baja lo que retiene la plataforma y no el precio del fotógrafo. Al fotógrafo le suma: por eso «Tu precio» se calcula con `retenidoEsperadoMp`.

**Reintegros:**
- No se borra nada.
- Un reintegro total crea un **renglón negativo** con fecha del reintegro, y la venta original queda marcada «Reintegrada». Así el total de un mes cerrado no cambia de golpe: el reintegro resta en el mes en que ocurre.
- Un reintegro parcial resta sólo lo devuelto, tomado de Mercado Pago, porque CLF no lo distingue.
- Un contracargo se trata igual, con el motivo «contracargo».

**Revalidación.** Las ventas de los últimos 180 días se vuelven a consultar en Mercado Pago una vez por día, para atrapar reintegros que CLF no haya avisado. Tope de 300 consultas por espacio y por corrida.

### 5.4 Separado del dinero de mostrador

- Las ventas CLF van a una **tabla propia**, `FotofficeClfVenta` (más `FotofficeClfVentaMovimiento` para el renglón original y los negativos). **No crean `CashMovement`**: la Caja diaria, la Caja fuerte, la cuenta «Mercado Pago» de Caja, los arqueos y los Informes de resultados, flujo y monotributo **no cambian**.
- La pantalla nueva es **«Ventas CLF»** (`/ventas-clf`), dentro de un módulo nuevo `clf-sales` del registro de módulos. Lo enciende el admin de plataforma, como todos.
  - Arriba: totales del período (cobrado, comisión de plataforma, comisión de Mercado Pago y reintegros), con filtro por mes y por álbum.
  - Abajo: la lista de ventas con fecha, álbum, detalle, pagó la familia, tu precio, acreditado, id de pago de Mercado Pago y estado.
  - Botón de CSV.
- En la ficha del **pedido vinculado** (etapa 1), la tarjeta CompraMeLaFoto suma «Vendido por este álbum: N ventas, $X acreditado». Esto resuelve el pedido en $0 **sin cambiar el total del pedido**, que sigue siendo lo que firmó el cliente.
- **Permisos:** ver la pantalla requiere `verDinero` en el módulo `clf-sales`. Para el rol Equipo sin roles asignados, el nivel por omisión es **NONE**. **Es mi decisión:** en DNX, Sabina y Camila no ven estas ventas salvo que Daniel se lo dé desde Roles.
- **Para más adelante** (fuera de esta etapa): una opción «Sumar Ventas CLF a Informes» como renglón aparte, nunca mezclado con la Caja. **Que la Caja nunca toque ventas CLF es mi decisión.**

---

## 6. Etapa 3 — Ingresos de la plataforma DNX (sólo la cuenta de Daniel)

**Lo que pidió Daniel el 07/11/2026:**
- Verlo **desde dnxfotografia@gmail.com**, y **sólo con esa cuenta**.
- Ver las comisiones de **CLF y también las que genera FOTOFFICE**. Más adelante, las del resto de las plataformas; hoy sólo esas dos generan comisiones.
- Ver el **dinero limpio que le llega**, asociado a los cobros de Mercado Pago.
- Que Sabina, Camila y cualquier usuario futuro **no** lo puedan ver.

### 6.1 Quién lo ve

- Hay un permiso personal nuevo, **«Ingresos de la plataforma»**, que se guarda en una tabla propia: `FotofficePlatformGrant`, con `userId`, `permiso`, `otorgadoPor` y `otorgadoEl`.
- Se lo da **únicamente** al usuario 4 de FOTOFFICE (dnxfotografia@gmail.com).
- **No sale** de ningún rol:
  - Ni del rol dentro del espacio (dueño, admin, Equipo).
  - Ni de `GlobalRole`. **El super admin tampoco lo ve** si no tiene el permiso.
  - Así, a dnxfotografia no hace falta devolverle el super admin, y nadie que se sume a DNX Estudio, por más permisos que tenga, llega a esta pantalla.
- **No hay pantalla para dar este permiso.** Se da por SQL, con registro en la auditoría de plataforma. **Es mi decisión:** sacar el botón elimina el riesgo de que alguien se lo dé por error.
- La pantalla vive fuera de los espacios, en `/mi-cuenta/ingresos-plataforma`, y aparece en el menú de cuenta sólo para quien tiene el permiso.
- Para cualquier otra persona, la dirección responde **404**: ni siquiera se entera de que existe.
- Las rutas de datos piden el permiso en el servidor en cada consulta; esconder el botón no alcanza.

### 6.2 Qué muestra

**Por mes, y por plataforma (CLF, FOTOFFICE y, más adelante, las demás):**

| Columna | Qué es |
|---|---|
| Ventas | cantidad de cobros con comisión |
| Comisión bruta | lo que la plataforma cobró arriba del precio |
| Descuentos a referidos | lo que se le perdonó al vendedor referido (CLF) |
| Pagado a quienes refirieron | `ReferralEarning` no revertido (CLF) |
| **Dinero limpio** | bruta − descuentos − pagado a quienes refirieron. **Es la cifra principal** |
| Confirmado en Mercado Pago | cuánto de ese dinero limpio está encontrado en la cuenta 97484805 (ver 6.4) |
| Retenido para terceros | lo que entra a la cuenta pero se le debe a otro (comisión de organizadores en CLF). Va aparte y **no** suma al dinero limpio |

**Abajo de la tabla**
- Detalle de cada cobro: fecha, plataforma, espacio o fotógrafo, álbum o concepto, comisión, id de pago de Mercado Pago y estado de la conciliación («Confirmado», «Pendiente de liberar», «No encontrado», «Reintegrado»).
- Botón de CSV.
- Los reintegros restan en el mes en que ocurren.
- **Ventas propias de DNX.** Cuando la que vende es la misma cuenta 97484805, la comisión se muestra con la marca «venta propia», porque ese dinero entra junto con el precio. **Es mi decisión:** se cuenta en el dinero limpio, pero el filtro «sin ventas propias» deja ver lo que pagaron los demás.

### 6.3 De dónde salen los números

**Las reglas son las de `/admin/finanzas-dnx/balance` de CLF (PR 633).** Ese balance ya calcula el neto de cada plataforma y se verificó contra SQL directo. Las reglas se mueven a un paquete compartido, para que el balance de CLF y este panel nunca den cifras distintas. Las que importan:
- **CLF**
  - Usa `platformCommissionCents` en pesos, que ya trae el recargo por extensión.
  - Resta `referralFeeDiscountCents` y `ReferralEarning.referralAmountCents` sin `reversedAt`.
  - Descarta las copias `PrintOrder` con `ALBUM_ORDER:*`.
  - La comisión de organizadores sale de la parte del fotógrafo.
- **FOTOFFICE**
  - Usa `platformFeeArs` de los cobros por Mercado Pago. Puede incluir comisión arrastrada de cobros en efectivo, que se retuvo en ese pago.
  - La de efectivo, transferencia u «OTRO» no cuenta hasta que se retiene o queda `SALDADO_MANUAL`.
  - Los cobros `HIST:*` importados tienen comisión 0.

**Cómo se trae cada plataforma**
- **CLF:** ruta nueva `GET /api/integraciones/fotoffice/v1/comisiones?cursor=…`. Pide una **llave de plataforma** (`DNX_CLF_PLATFORM_FEES_KEY`) que sólo conoce el servidor de FOTOFFICE. Devuelve cobro por cobro, sin datos de compradores. Un cron la trae cada hora y la guarda en `FotofficePlataformaComision`.
- **FOTOFFICE:** se lee de su propia base, de los cobros de todos los espacios, y se guarda en la misma tabla con plataforma = FOTOFFICE.
- **Más adelante:** cada plataforma nueva (SubiLaFoto, FotoRank) se suma como otra fuente, sin cambiar la pantalla.

### 6.4 Asociación con los cobros de Mercado Pago

Todas las aplicaciones de Mercado Pago de DNX (DNX Suite/CLF, FotoOffice) pertenecen a la cuenta **97484805**, así que las comisiones entran ahí. Para confirmar que cada comisión entró de verdad:
- FOTOFFICE usa la credencial de esa cuenta, que es la que DNX Estudio tiene conectada en Cobros, para pedir el **reporte de liberaciones** de Mercado Pago. Ese reporte trae cada movimiento de dinero de la cuenta, incluidas las comisiones de marketplace, con el id del pago de origen.
- Cada renglón se empareja con la comisión por id de pago:
  - **Confirmado:** el monto coincide.
  - **Pendiente de liberar:** Mercado Pago todavía no liberó el dinero.
  - **No encontrado:** no está en el reporte.
  - **Reintegrado:** Mercado Pago lo devolvió.
- **Primer paso obligatorio de la etapa 3: prueba de factibilidad.** Hay que pedir un reporte real de un mes y confirmar que trae las comisiones de cobros hechos por **otras** cuentas, con el id de pago de origen.
  - Si no las trae, la confirmación se hace leyendo cada pago con el token de la aplicación (`GET /v1/payments/{id}`, que muestra `application_fee`).
  - Si ninguna de las dos funciona, la columna «Confirmado en Mercado Pago» queda como «sin verificar» y se le avisa a Daniel antes de seguir.

---

## 7. Seguridad y datos personales

- Las llaves viajan sólo de servidor a servidor. En CLF se guardan como hash y en FOTOFFICE cifradas. Toda llave se puede revocar, y CLF anota la última vez que se usó.
- La API de ventas responde sólo los álbumes de la cuenta dueña de la llave. Una llave de fotógrafo nunca ve comisiones de otros.
- Se aplica un límite de pedidos por llave: 60 por minuto.
- **No cruzan a FOTOFFICE:** datos de compradores, de alumnos (nombre, curso, división, notas), selfies o datos biométricos, fotos, direcciones de retiro, tokens de Mercado Pago de CLF, ni el padrón de usuarios de CLF.
- **Cruza:** el id y el `mpUserId` de la cuenta de CLF conectada, los álbumes (id, título, slug), el detalle de packs y productos, los montos, los ids de pago y los estados.
- **Registro.** Conectar, desconectar, cada sincronización (cuántas ventas, cuántas con diferencia) y cada lectura de comisiones de plataforma quedan en la línea de tiempo o en la auditoría de plataforma.

## 8. Preguntas abiertas para Daniel

Ninguna. Daniel decidió el 07/11 quién ve los ingresos de la plataforma (§6.1). Falta sólo que apruebe este documento.

## 9. Decisiones que tomé yo (para revisar)

- Un álbum por pedido. El proyecto sólo tiene vínculo propio si no tiene pedido.
- `[preventa_enlace]` usa la forma `/album/<slug>/preventa`, la misma que está pegada hoy en el contrato 2026-0001.
- La etapa 2 arranca con una prueba de lectura real en Mercado Pago. Para las ventas de DNX, donde la cuenta se cobra a sí misma, puede quedar el estado «Validada (cuenta propia)».
- Dinero limpio de la plataforma = bruta − descuentos a referidos − pagado a quienes refirieron. Lo retenido para organizadores va aparte.
- El permiso «Ingresos de la plataforma» se da sólo por SQL: no hay pantalla para darlo, y ni el super admin lo ve sin el permiso.
- Las comisiones de ventas propias de DNX cuentan en el dinero limpio, con marca y filtro.
- La conciliación con Mercado Pago usa el reporte de liberaciones de la cuenta 97484805, y antes hay que probar que sirve.
- En la etapa 1 se acepta cualquier enlace válido de CLF, sin verificar que el álbum sea del fotógrafo.
- Si las cuentas de Mercado Pago no coinciden, la conexión se hace igual, pero ninguna venta sale validada.
- FOTOFFICE pregunta a CLF cada 15 minutos; CLF no empuja las ventas.
- El total principal es «Acreditado en Mercado Pago» (con la comisión de Mercado Pago descontada). «Tu precio» también queda a la vista.
- Los reintegros son renglones negativos en el mes en que ocurren.
- Las ventas de álbumes donde el fotógrafo es sólo colaborador quedan afuera por ahora.
- El rol Equipo no ve Ventas CLF por omisión.
- Ventas CLF nunca entra a la Caja; a Informes, más adelante y como renglón aparte.

## 10. Lo que queda para quien lo construya

- Nombres finales de tablas, índices y rutas, respetando los prefijos `Fotoffice` y `clf_`/`fotoffice_` en las migraciones.
- La forma exacta de leer `pagadoEl` y el motivo del reintegro desde `OrderAuditLog`.
- Cómo se muestra la tarjeta en las fichas, siguiendo el estilo de las fichas actuales.
- Las migraciones de FOTOFFICE se aplican a mano en la rama `development` y se registran en `_prisma_migrations`. Las tablas nuevas de CLF (códigos y llaves de conexión) se aplican en la rama `production`. Las dos van **antes** de fusionar.
- Trabajar desde `origin/main` en una copia de trabajo propia: el `main` local está atrasado.
