# Muestras Fotográficas — puesta en marcha

Guía para dejar el sitio funcionando en producción. Cada paso dice quién lo hace:
**lo hace Daniel** o **lo hace Claude con permiso** (Claude pide autorización antes de actuar).

## Estado al 08/10/2026

| Paso | Estado |
|---|---|
| Dominio `muestrasfotograficas.com` comprado en DonWeb | Hecho |
| Migración `20261025120000_muestras_etapa_1` aplicada | Hecho (08/10/2026) |
| Proyecto de Vercel `muestras-dnxsuite` creado | Hecho |
| Variables de entorno en Vercel | Pendiente |
| Dominio conectado en Vercel + DNS | Pendiente |
| URI de redirección en Google Cloud | Pendiente |
| Verificar dominio en Resend y encender correos | Pendiente |
| Cargar muestras reales | Pendiente |

## 1. Dominio — hecho (lo hizo Daniel)

Se compró `muestrasfotograficas.com` en DonWeb. Es el dominio canónico (sin `www`);
`www.muestrasfotograficas.com` redirige al dominio sin `www`. Queda opcional mirar el `.com.ar`.

## 2. Migración de base de datos — hecha (la hizo Claude con permiso)

La migración `20261025120000_muestras_etapa_1` ya está aplicada en producción desde el
08/10/2026, en la base de Neon `divine-hall-10689679`, rama `development` (la misma de FOTOFFICE),
y está registrada en `_prisma_migrations`. No hay que volver a correrla.

## 3. Proyecto de Vercel — creado (lo hizo Claude con permiso)

- Proyecto: `muestras-dnxsuite` (`prj_yZNfeUfKtGhuGA4RXnfwQL10dDxq`).
- Root Directory: `apps/muestras`. Rama de producción: `main`.
- Los deploys de Preview están desactivados: `apps/muestras/vercel.json` tiene un `ignoreCommand`
  que saltea cualquier build que no sea de producción.

## 4. Variables de entorno en Vercel — lo hace Daniel (o Claude con permiso)

Cargarlas en el proyecto `muestras-dnxsuite`, entorno **Production**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La misma que `fotoffice-dnxsuite` |
| `DIRECT_URL` | La misma que `fotoffice-dnxsuite` |
| `GOOGLE_CLIENT_ID` | El mismo cliente compartido que usan `subilafoto-dnxsuite` y FOTOFFICE |
| `GOOGLE_CLIENT_SECRET` | Idem |
| `APP_URL` | `https://muestrasfotograficas.com` |
| `NEXT_PUBLIC_APP_URL` | `https://muestrasfotograficas.com` |
| `AUTH_URL` | `https://muestrasfotograficas.com` |
| `R2_ACCOUNT_ID` | El de la cuenta de Cloudflare |
| `R2_ENDPOINT` | El endpoint S3 de la cuenta de R2 |
| `R2_ACCESS_KEY_ID` | De un token de API de R2 con permiso Object Read & Write sobre el bucket `fotoffice-media` |
| `R2_SECRET_ACCESS_KEY` | Idem |
| `R2_BUCKET_NAME` | `fotoffice-media` |
| `R2_PUBLIC_URL` | `https://pub-2086bd02202c406a9b952f2dbfa945c9.r2.dev` |
| `GEOCODING_USER_AGENT` | `MuestrasFotograficas/1.0 (muestrasfotograficas.com)` |
| `MUESTRAS_CORREOS_EN_VIVO` | `false` (por ahora) |
| `MUESTRAS_CONTACTO_EMAIL` | La casilla para pedidos de baja de datos (se muestra en `/privacidad`). Opcional: si falta, la página dice que se puede pedir respondiendo cualquier correo de Muestras o contactando a la organización que opera DNX Suite |

**No cargar estas dos**, aunque estén en otros proyectos de la suite:

- `COOKIE_DOMAIN`: FOTOFFICE usa `.dnxsuite.com`. Si se copia acá, el navegador descarta la
  cookie de sesión en `muestrasfotograficas.com` (no es de ese dominio) y nadie puede entrar.
  Sin la variable, la cookie queda atada al dominio del sitio, que es lo correcto.
- `GOOGLE_REDIRECT_URI`: si se copia la de otro proyecto, Google devuelve a la persona a esa otra
  plataforma después de elegir la cuenta. Sin la variable, el sitio arma solo
  `https://muestrasfotograficas.com/api/auth/google/callback` a partir de `APP_URL`.

**Después de cambiar variables hay que volver a desplegar**: Vercel no las aplica a un deploy que
ya existe. Ojo: el `ignoreCommand` de `apps/muestras/vercel.json` puede saltear el redeploy de un
commit que ya se construyó. En ese caso, desde el panel de Vercel usar **Redeploy** con
"Use existing Build Cache" **apagado**, o subir un commit que toque algo de `apps/muestras`.

Más adelante, cuando el dominio esté verificado en Resend (paso 7): `RESEND_API_KEY`
(marcarla como sensible) y `MUESTRAS_EMAIL_FROM`.

## 5. Conectar el dominio en Vercel y DNS en DonWeb — lo hace Daniel (o Claude con permiso para la parte de Vercel)

1. En Vercel, proyecto `muestras-dnxsuite` → Domains: agregar `muestrasfotograficas.com`
   como dominio principal y `www.muestrasfotograficas.com` con redirección al principal.
2. En DonWeb, zona DNS del dominio (lo hace Daniel):
   - Registro **A** del dominio raíz (apex) → `76.76.21.21`
   - Registro **CNAME** de `www` → `cname.vercel-dns.com`
   - Confirmar estos valores contra lo que Vercel muestre al agregar el dominio; si difieren, usar los de Vercel.
3. Esperar a que Vercel marque ambos dominios como válidos (puede tardar de minutos a unas horas).

## 6. Google Cloud — lo hace Daniel (consola de Google)

En el proyecto `compramelafoto-auth`, cliente OAuth compartido de la suite:

- Agregar a **URIs de redireccionamiento autorizados**:
  `https://muestrasfotograficas.com/api/auth/google/callback`
- Agregar a **Orígenes autorizados de JavaScript**:
  `https://muestrasfotograficas.com`

Sin esto el botón "Entrar con Google" falla.

## 7. Correos con Resend — lo hace Daniel

1. Verificar el dominio `muestrasfotograficas.com` en Resend (agregar los registros DNS que pide, en DonWeb).
2. Cargar `RESEND_API_KEY` y `MUESTRAS_EMAIL_FROM` en Vercel.
3. Recién entonces poner `MUESTRAS_CORREOS_EN_VIVO=true` y volver a desplegar.

Mientras tanto los correos quedan apagados (hace falta que estén las dos cosas: la clave y el interruptor en `true`).

## 8. Primer deploy y prueba — lo hace Claude con permiso

Con todo lo anterior cargado, desplegar `main` en producción y recorrer: proponer una actividad,
aprobarla como super admin, verla en el mapa, en el listado y en su ficha.

## 9. Cargar muestras reales — lo hace Daniel con ayuda de Claude

Cargar 2 o 3 muestras reales de SFPR para que el mapa no arranque vacío.

## Etapa 2 — perfiles de fotógrafos y fichas de sala con QR

- **Migración:** `20261027120000_muestras_etapa_2_perfiles` ya está aplicada en la base de
  producción. No hay que correr nada.
- **Antes de imprimir un QR:** confirmar en Vercel (proyecto de Muestras, entorno Production) que
  `APP_URL=https://muestrasfotograficas.com`. Si en producción `APP_URL` apunta a `localhost`, a una
  dirección `*.vercel.app` o no es `https`, el sitio usa igual `https://muestrasfotograficas.com` y
  deja un aviso en el log: conviene corregir la variable de todos modos.
- **Regla de perfiles en una muestra publicada:** quien la propuso puede dejar el autor que la obra
  ya tenía, vincularla a su propio perfil o desvincularla. Para sumar el perfil de otra persona
  tiene que escribirnos (el super admin puede vincular cualquiera). En borrador o rechazada se
  puede vincular cualquier perfil, porque todo pasa por revisión.
- **Fichas:** hasta 100 PDFs cada 10 minutos por persona (alcanza para la ficha de cada una de las
  40 obras más el PDF completo). Sin sesión, el enlace de descarga lleva a ingresar y vuelve a
  Montaje e impresión.

Cómo probarlo de punta a punta:

1. Ingresar y crear el perfil en **Panel → Mi perfil**.
2. Proponer una muestra con obras (alguna con el propio nombre como autor, para ver que se
   vincula sola) y enviarla a revisión.
3. Como super admin, aprobarla en `/panel/revision`.
4. En **Montaje e impresión** (o en la página de la muestra en el panel) bajar el PDF de todas las
   fichas en A6.
5. Escanear un QR con el celular: tiene que abrir `https://muestrasfotograficas.com/m/<muestra>/o/<obra>`.
6. Ver que el perfil aparece en `/fotografos` y en `/fotografos/<slug>`.

## Etapa 3 — convocatorias y curaduría anónima

- **Migración:** `20261028120000_muestras_etapa_3_convocatorias` ya está aplicada en la base de
  producción (cinco tablas `CulturalCall*`). No hay que correr nada.
- **R2 con permiso de lectura:** las fotos de la curaduría se sirven desde el servidor (nunca se
  muestra la dirección del archivo). La clave R2 del proyecto de Muestras en Vercel tiene que poder
  **leer** objetos, no sólo subirlos. Si no puede, el curador ve las fotos en blanco.
- **Correos:** con los correos apagados, al invitar a un curador la pantalla muestra el enlace para
  copiarlo y mandarlo a mano. Los avisos de cierre y de resultados no se reenvían: conviene encender
  los correos (sección 7) antes de la primera convocatoria real.
- **Reglas para abrir una convocatoria:** la muestra tiene que estar publicada (con al menos una obra,
  que cuenta para el tope de 40) y tener sala o dirección. Las muestras sólo virtuales no convocan.
- **Invitaciones a curar:** se aceptan sólo entrando con la cuenta de Google del mail invitado. El
  organizador y quien invitó no pueden curar su propia convocatoria.
- **Anonimato:** curadores y organizador ven sólo códigos (A-001…). Los nombres aparecen recién al
  cerrar la curaduría.

Cómo probarlo de punta a punta:

1. Con una muestra publicada que tenga sala, abrir **Panel → Convocatorias**, crear la convocatoria
   y abrirla.
2. Con otra cuenta, entrar a `/convocatorias/<slug>` y mandar obras.
3. Invitar a un curador (con los correos apagados, copiar el enlace) y aceptarlo con su cuenta.
4. Cerrar la recepción, empezar la curaduría y puntuar desde **Panel → Curaduría**.
5. En **Selección**, elegir obras, cerrar la curaduría y tocar **Armar la muestra**.

## Etapa 4 — la sala: piezas para imprimir, estadísticas y libro de visitas

- **Migración:** `20261029120000_muestras_etapa_4_sala` ya está aplicada y registrada en la base de
  producción (columnas `curatorialText`, `curatorCredits`, `guestbookMode` y `hangingPlan` en
  `CulturalActivity`, y las tablas `CulturalActivityDailyStat` y `CulturalActivityGuestbookEntry`).
  No hay que correr nada.
- **Piezas para imprimir** (**Panel → Montaje e impresión**): remarcos y marcos, cartel de sala
  con el texto curatorial, catálogo, afiche del libro de visitas y plano de montaje, en PDF. Los PDF
  de más de 4 MB se suben a R2 (`muestras/piezas/`) y la descarga redirige ahí. Conviene una regla
  de vencimiento en el bucket para ese prefijo (7 a 30 días).
- **Calidad de impresión:** las fotos guardadas tienen 2000 px: bien en A4, aceptables hasta
  40×50, blandas en 50×70 (el panel lo avisa y ofrece "sólo el remarco").
- **QR con conteo:** las fichas, carteles y afiches nuevos usan `/q/o|m|l/<id>`, que cuenta el
  escaneo y redirige. Las fichas impresas antes siguen andando, pero cuentan como visita.
- **Visitas:** contadores diarios por muestra y obra, sin IP, sin cookies y sin datos de quien
  visita. No cuentan robots ni a quien organiza.
- **Libro de visitas:** sin cuenta, con campo trampa, tiempo mínimo y frenos. Por defecto publica
  al instante; el organizador puede ocultar o borrar, o pasarlo a "revisar antes" o "cerrado".
  Recibe hasta 15 días después del cierre.

Cómo probarlo de punta a punta:

1. Con una muestra publicada, cargar el texto curatorial en el editor y verlo en la ficha pública.
2. En **Montaje e impresión**, bajar un marco A4, el cartel, el catálogo y el afiche del libro.
3. Armar el plano: dos paredes, asignar obras, guardar y bajar el PDF.
4. Escanear el QR del afiche con el celular, dejar un comentario y moderarlo desde el panel.
5. Abrir la ficha desde otro dispositivo y ver al día siguiente las visitas en **Estadísticas**.

## Etapa 5 — difusión y equipo

- **Migración:** `20261030120000_muestras_etapa_5_difusion` ya está aplicada y registrada en la base
  de producción (11 columnas en `CulturalActivity` y las tablas `CulturalActivityMember` y
  `CulturalActivityRsvp`). No hay que correr nada.
- **Equipo de la muestra** (Panel → la muestra → Equipo): hasta 10 personas, con dos roles:
  *Coorganización* (edita la muestra, montaje, piezas, difusión e inauguración, modera el libro y ve
  estadísticas; no cancela ni maneja el equipo ni la convocatoria) y *Textos y curaduría* (sólo
  textos). La invitación se acepta sólo con la cuenta de Google del mail invitado; con los correos
  apagados, quien invita ve el enlace para copiarlo.
- **Inauguración** (`/m/<slug>/inauguracion`): fecha, hora, mapa, agendar (.ics y Google Calendar) y
  "Voy" sin cuenta, con cupo y lista de espera. El equipo ve la lista y baja un CSV. Nombres y mails
  se borran 30 días después del cierre de la muestra (queda sólo el total).
- **Tarea diaria de borrado:** está en `vercel.json` (06:00 hora argentina). Para encenderla hay que
  crear la variable `CRON_SECRET` en Vercel (proyecto de Muestras). Sin ella la ruta responde 503 y
  el borrado igual ocurre al abrir el panel.
- **Piezas para redes** (Panel → Difusión): posteo, historia y cuadrado con las variantes Inaugura,
  Últimos días, Obra destacada e Invitación, más la invitación en PDF A6 y A5. Sólo con la muestra
  publicada. Usan la fuente Roboto (Apache 2.0) incluida en `apps/muestras/assets/fonts`.

## Etapa 6 — expositores por enlace y sorpresa de la muestra

- **Migración:** `20261031120000_muestras_etapa_6_expositores` ya está aplicada y registrada en la
  base de producción (columna `visibility` en `CulturalActivity` y seis tablas nuevas de expositores,
  portfolio y sala). No hay que correr nada.
- **Enlace de expositores** (Panel → la muestra → Expositores): un enlace por muestra para que los
  artistas ya elegidos se den de alta con Google, completen su perfil, acepten los derechos y carguen
  sus obras (la foto que se cuelga y todos sus datos). La organización aprueba o pide cambios; lo
  aprobado entra a la galería, las fichas, el catálogo y el plano.
- **Visibilidad** (Panel → la muestra → Visibilidad): qué se ve según por dónde se entra — página
  online (todas, destacadas, N al azar fijas / diarias / por visitante, o ninguna), perfil del
  artista y QR de la sala. Presets: Adelanto, Sorpresa total, Destacadas, Todo a la vista.
- **Portfolio del artista** (hasta 60 fotos): son las obras que no se cuelgan; se ven en su perfil y
  en "Artistas" de cada muestra.
- **QR de sala:** las fichas nuevas llevan `/q/s/<código>`. Al escanear, la persona tiene un pase de
  8 horas (cookie firmada) para ver esa obra, el artista, sus otras obras, sus muestras y
  "Adquirir obra" (hoy: "La venta de esta obra todavía no está disponible"). Hay que **reimprimir las
  fichas** para usarlo. Desde Visibilidad se pueden cortar los accesos o cambiar los códigos.
- **Sin tope de 40 obras:** el máximo técnico es 300; los marcos con foto se bajan por tandas de 40 y
  `/api/piezas` usa `maxDuration = 300` (el equipo de Vercel ya usa funciones largas en CLF).

Cómo probarlo de punta a punta:

1. En una muestra publicada con sala, elegir la visibilidad y generar el enlace de expositores.
2. Con otra cuenta, abrir el enlace, darse de alta, cargar una obra y enviarla.
3. Aprobarla desde Expositores y ver que entra a la galería.
4. Bajar las fichas, escanear el QR con el celular y ver la vista de sala y "Adquirir obra".
5. Abrir la muestra online en una ventana privada y confirmar que respeta la sorpresa.

## Etapa 7 — concurso de FotoRank → muestra

- **Migración:** `20261101120000_muestras_etapa_7_fotorank` ya está aplicada y registrada en la base
  de producción (tablas `CulturalContestImport`, `CulturalContestWork` y `CulturalContestAuthor`).
  No hay que correr nada.
- **Variable nueva en Vercel (proyecto Muestras):** `DNX_FOTORANK_LINK_SECRET`, con el mismo valor
  que en FotoRank y FOTOFFICE, más `FOTORANK_PUBLIC_BASE_URL=https://fotorank.dnxsuite.com`. Sin la
  clave, la muestra se arma igual pero las imágenes no se copian.
- **Cómo funciona:** en FotoRank, Resultados del concurso → "Armar muestra" (sólo OWNER, ADMIN o
  EDITOR de la organización, o super admin; nunca maratones). En Muestras se eligen los niveles
  (ganadores y menciones marcados; finalistas opcionales) y se crea un borrador "Muestra <concurso>"
  con fechas provisorias, o se suman las obras a una muestra existente. Se puede repetir sin duplicar.
- **Permiso del autor:** si las bases del concurso autorizaban exhibir, la obra entra y el autor la
  ve en "Dónde expongo" (puede retirarla); si no, tiene que aceptar. El nombre se muestra si las
  bases piden atribución o el autor lo confirma; si no, "Autoría reservada".
- **Imágenes:** se copian por tandas al bucket de Muestras, una copia por muestra, recién cuando la
  obra entra a la galería; se borran si el autor la retira o la organización la saca.
- **FotoRank** sólo suma el recuadro "Armar muestra" y el bloque "Muestras del concurso" en lo
  público (si algo falla, no se muestra). Los resultados oficiales todavía no se pueden publicar en
  producción: se usa el último lote cerrado por la organización.

Cómo probarlo de punta a punta:

1. Con un concurso de FotoRank con resultados cerrados, entrar a Resultados y tocar "Armar muestra".
2. En Muestras, elegir los niveles y armar el borrador.
3. En "Del concurso", copiar las imágenes y revisar las casillas de cada obra.
4. Con la cuenta de un autor, entrar a "Dónde expongo" y aceptar o retirar.
5. Completar fechas y sede, enviar a revisión, aprobar y ver el premio en la ficha y en el catálogo.

## Etapa 8 — pagos que quedaron "sin saber" (nota de operación)

Si al pagar Mercado Pago no contesta (corte de red o error 5xx), el pedido queda como `UNKNOWN_CREATE`: no se sabe si la Order se creó. Muestras **no depende del aviso de CLF** para resolverlo (hoy CLF no procesa avisos en vivo):

- El barrido (`/api/cron/ventas`, cada 10 minutos) busca esos pedidos en Mercado Pago por su referencia (`muestras-venta-<publicId>`, con `GET /v1/payments/search?external_reference=…`) durante 7 días. Si aparece la Order, la concilia: pagada → copia emitida (o pago tardío con otro número, o "cobrado sin copia").
- Mientras no aparezca, el pedido se ve **en rojo** en `/panel/ventas` ("Conciliar a mano"). Si hay un pago con esa referencia pero no su Order, queda la alerta "hay un pago con esta referencia y no encontramos su Order": buscarlo a mano en Mercado Pago y devolverlo si corresponde.
- Si Mercado Pago cobra un pedido que ya se había dado por rechazado, queda la alerta `ALERT_PAID_ON_TERMINAL` con la devolución pedida: el super admin la hace con "Devolver el pago".
- Crear una Order y devolverla **nunca se reintentan solas**: ante la duda, el pedido queda pendiente y lo resuelve la conciliación.

## Etapa 8 — venta de obras, ediciones limitadas y certificados

- **Migración:** `20261102120000_muestras_etapa_8_venta` ya está aplicada y registrada en la base de
  producción (9 tablas nuevas, ninguna columna en tablas existentes). No hay que correr nada.
- **La venta sale APAGADA.** Hay tres modos según las variables:
  - **OFF** (por defecto): el público ve "La venta de esta obra todavía no está disponible" y ningún precio.
  - **TEST**: `MUESTRAS_MP_ENV=sandbox` + credenciales de un usuario de prueba de Mercado Pago. Sólo
    compran el super admin y `MUESTRAS_VENTAS_PROBADORES`; numeración y certificados "de prueba".
    La app verifica con `GET /users/me` que la cuenta sea `test_user`; si no, queda en OFF.
  - **LIVE**: `MUESTRAS_VENTAS_EN_VIVO=true` + `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true` +
    `MUESTRAS_MP_ENV=production` + todo lo demás. Recién cuando Mercado Pago cierre la homologación.
- **Reparto:** 15 % plataforma (absorbe la comisión de Mercado Pago); el resto lo reparte cada
  organización entre ella y el fotógrafo/a, y cada autor lo acepta. El envío es de la organización.
- **Precios:** los propone el autor por formato (digital única/limitada, impresa única/limitada
  Fine Art con papel y medida), entre $1.000 y $20.000.000, y la organización los aprueba.
- **Ediciones:** números reservados 20 minutos; nunca se pasa de N (probado con 25 compras
  simultáneas sobre una edición de 10 en una base descartable); los anulados no se reutilizan;
  hasta 5 P/A; la venta cierra 30 días después del cierre de la muestra.
- **Certificados:** firmados con Ed25519, PDF con la firma escaneada del autor, etiqueta con QR de
  10×6 cm para el dorso, archivo digital con XMP y página `/verificar/<código>`.
- **Confirmación del pago:** al crear, al volver el comprador, por aviso de CLF y por barrido cada
  10 minutos (`/api/cron/ventas`, con `CRON_SECRET`). Siempre se lee la orden en Mercado Pago.
- **Devoluciones:** sólo el super admin, y sólo totales (la parcial con reparto falla en MP).

### Variables nuevas en Vercel (las secretas las carga Daniel)

Proyecto **muestras-dnxsuite**:
- `MUESTRAS_MP_ENV` (`sandbox` / `production`), `MUESTRAS_MP_ACCESS_TOKEN` (secreta),
  `MUESTRAS_MP_PUBLIC_KEY`, `MUESTRAS_MP_OWNER_USER_ID` (sólo dígitos; la cuenta del token).
- `MUESTRAS_VENTAS_EN_VIVO`, `MUESTRAS_VENTAS_PROBADORES` (emails o ids separados por coma).
- `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` y `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` (sólo al pasar a vivo).
- `MUESTRAS_PEDIDOS_SECRET` (secreta, al azar: `openssl rand -hex 32`).
- `MUESTRAS_CERT_PRIVATE_KEY` (secreta) y `MUESTRAS_CERT_KEY_ID`: clave Ed25519 en PEM. Se genera con
  `openssl genpkey -algorithm ed25519`. `MUESTRAS_CERT_OLD_PUBLIC_KEYS` sólo si se rota.
- `MUESTRAS_AVISO_PAGOS_SECRET` (secreta, al azar) — **el mismo valor** en Comprame la Foto.
- `MUESTRAS_R2_PRIVATE_BUCKET`: bucket R2 **privado** (distinto de `fotoffice-media`) para originales,
  firmas y piezas; con CORS que permita `PUT` desde `https://muestrasfotograficas.com`.
- `CRON_SECRET` (ya pedido en la Etapa 5).

Proyecto **compramelafoto-dnxsuite**:
- `MUESTRAS_AVISO_PAGOS_URL=https://muestrasfotograficas.com/api/pagos/aviso`
- `MUESTRAS_AVISO_PAGOS_SECRET` (el mismo que en Muestras).

Antes de vender con dinero real: revisión legal de los términos y del botón de arrepentimiento,
prueba de 3-D Secure en sandbox, confirmar que la Order de producción devuelve `splits` y que
`/v1/payments/search` encuentra pagos por `external_reference`.
