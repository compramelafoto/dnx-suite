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
