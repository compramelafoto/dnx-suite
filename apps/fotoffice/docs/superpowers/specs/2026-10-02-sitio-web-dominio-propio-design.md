# Dominio propio para el sitio web de una institución

**Fecha:** 02/10/2026 · **Estado:** construido en la rama `feat/fotoffice-dominio-propio`
**Caso que lo motiva:** la SFPR quiere que su sitio se vea en `sfpr.com.ar`, no en
`<fotoffice>/w/sfpr`.

## 1. Qué resuelve

Hoy el sitio público de cada institución vive en `/w/<slug>` dentro del dominio de FOTOFFICE.
Con esta función, el dueño o administrador de la institución entra a **Sitio web → Dominio**,
escribe su dominio (`sfpr.com.ar`) y el sistema:

1. lo registra en el proyecto de Vercel de FOTOFFICE (si la conexión con Vercel está
   configurada);
2. le muestra **exactamente qué registros DNS copiar** en NIC Argentina o en quien administre
   el dominio;
3. le dice si ya quedó conectado ("Pendiente" → "Conectado ✓"), con un botón "Comprobar ahora".

Desde ese momento, `sfpr.com.ar` muestra el mismo sitio que `/w/sfpr`, con direcciones limpias:
`sfpr.com.ar/cursos`, `sfpr.com.ar/blog/mi-articulo`, etc. La dirección vieja `/w/sfpr` sigue
funcionando en el dominio de FOTOFFICE: nada de lo que ya se compartió se rompe.

## 2. Lo que el sistema NO puede hacer (y la pantalla lo dice)

- **Cambiar el DNS.** Lo hace quien administra el dominio (NIC Argentina, el proveedor de
  hosting, etc.). La pantalla muestra los datos a copiar.
- **Tocar el correo.** Si el dominio ya tiene correos (`@sfpr.com.ar`), sus registros `MX` y
  `TXT` (SPF, DKIM) **no se tocan**. Sólo se cambian el registro `A` del dominio y el `CNAME`
  de `www`. La pantalla lo advierte en negrita, porque es el error que más daño hace.
- Si el dominio hoy apunta a otra web (por ejemplo, la vieja de Alboom), esa web deja de verse
  en el momento en que se cambia el registro `A`. Conviene hacerlo con el sitio nuevo ya
  publicado.

## 3. Diseño

### 3.1 Datos — tabla nueva `FotofficeWorkspaceDomain`

Tabla propia, no columnas en `FotofficeWorkspaceWebsite`: el esquema se comparte con otras
bases y una columna sin aplicar rompe todas las consultas del modelo. Una tabla nueva sin
aplicar sólo rompe las consultas a esa tabla, y el filtro de entrada las tolera (ver 3.2).

| Campo | Qué guarda |
|---|---|
| `workspaceId` (único) | Una institución, un dominio (por ahora). |
| `domain` (único) | El dominio raíz, en minúsculas, sin `www.` ni `https://`. Ej.: `sfpr.com.ar`. |
| `status` | `PENDING` (falta el DNS) · `CONNECTED` (apunta bien y Vercel lo verificó) · `ERROR`. |
| `vercelRegisteredAt` | Cuándo se agregó al proyecto de Vercel. `null` = no se pudo/no hay token. |
| `lastCheckedAt`, `lastError` | Resultado de la última comprobación, en lenguaje claro. |

Migración: `20261002180000_fotoffice_workspace_domain`. Se aplica a mano y se registra con
`prisma migrate resolve --applied` (el deploy de FOTOFFICE no migra).

### 3.2 El filtro de entrada (`proxy.ts`)

En Next 16 `middleware.ts` pasó a llamarse `proxy.ts`. Se renombra conservando lo que ya
hacía (atajo `/sfpr` → `/w/sfpr` y protección del panel) y se amplía su `matcher` a todas las
direcciones menos los recursos de Next, porque un dominio propio puede pedir cualquiera.

**El proxy no carga Prisma.** Corre antes de cada visita: si fallara al cargar, se caería la
aplicación entera. Para saber de quién es un dominio le pregunta a `/api/dominio-propio`
(una ruta común, con Prisma), recuerda la respuesta 60 s y, ante cualquier falla, deja pasar la
visita sin tocarla. Para cada visita:

1. **¿Es un dominio de FOTOFFICE?** (el de `APP_URL`, `localhost`, `*.vercel.app`). Sí → sigue
   como siempre (protección de rutas del panel). La enorme mayoría de las visitas termina acá,
   sin consultar la base.
2. **Si no, es un dominio propio.** Se pregunta a qué institución pertenece (con memoria de
   60 s para no consultar en cada visita). `www.sfpr.com.ar` → redirige a `sfpr.com.ar`.
3. Con el dominio identificado (`slug` = `sfpr`):
   - `/_next/*`, `/api/*` y archivos estáticos pasan sin tocar.
   - `/w/sfpr/...` → **redirección 308** a `/...`. Así todos los enlaces que hoy arman
     `/w/sfpr/cursos` (son 66 en el código) funcionan sin cambiarlos: dan un salto y quedan
     limpios.
   - Rutas del panel o de la sesión (`/login`, `/portal`, `/dashboard`, `/entrar`, …) →
     **redirección al dominio de FOTOFFICE**. La sesión vive en la cookie de FOTOFFICE; en otro
     dominio el navegador no la manda, así que iniciar sesión tiene que pasar allá.
   - Todo lo demás → **reescritura interna** a `/w/sfpr/...`. El visitante ve `sfpr.com.ar/cursos`;
     la app sirve la página `/w/sfpr/cursos` que ya existe.
4. Dominio desconocido o falla al leer la base → la visita sigue sin tocar (nunca tira el sitio).

### 3.3 Conexión con Vercel (`lib/website/domain/vercel.ts`)

Con `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID` si el proyecto es de un
equipo) configurados:
- Guardar dominio → agrega `sfpr.com.ar` y `www.sfpr.com.ar` al proyecto.
- Comprobar → pregunta a Vercel si está verificado y bien configurado.
- Quitar dominio → lo saca del proyecto.

Sin esas variables, la pantalla igual guarda el dominio, muestra los registros DNS, y avisa:
"Falta que DNX agregue el dominio en Vercel". La comprobación cae a una consulta DNS directa
(el registro `A` apunta a `76.76.21.21`).

### 3.4 La pantalla — Sitio web → Dominio (`/website/dominio`)

- Aparece en el menú lateral, debajo de "Sitio web" y "Blog", como **Dominio** (sólo dueño o
  administrador, igual que el Blog), y como pestaña en el menú secundario del sitio.
- Sin dominio: un campo "Tu dominio" + "Conectar". Acepta lo que la gente pega
  (`https://www.sfpr.com.ar/`) y lo normaliza a `sfpr.com.ar`.
- Con dominio: estado, tabla de registros DNS a copiar (tipo, nombre, valor) con botón copiar,
  la advertencia del correo, "Comprobar ahora" y "Quitar dominio".
- El personal (STAFF) la ve en sólo lectura.

### 3.5 Errores

- Dominio inválido o de FOTOFFICE → mensaje claro, no se guarda.
- Dominio ya tomado por otra institución → "Ese dominio ya está conectado a otra institución".
- Vercel responde error → se guarda igual con `lastError` legible; se puede reintentar.

## 4. Qué queda para después

- **Enlaces sin salto:** hoy los enlaces internos pasan por una redirección 308. Más adelante
  el armazón público puede armarlos ya limpios cuando sabe que está en el dominio propio.
- **Correos y pagos:** los enlaces en correos y las vueltas de Mercado Pago siguen usando el
  dominio de FOTOFFICE (funcionan, sólo que no muestran `sfpr.com.ar`).
- **SEO:** `sitemap.xml`/`robots.txt` y la URL canónica por dominio propio.
- Más de un dominio por institución.

## 5. Pasos para encender en producción

1. Aplicar el SQL de la migración en la base de FOTOFFICE y registrarlo con `migrate resolve`.
2. Cargar en Vercel (proyecto `fotoffice-dnxsuite`) las variables `VERCEL_API_TOKEN`,
   `VERCEL_PROJECT_ID` y, si corresponde, `VERCEL_TEAM_ID`.
3. Fusionar el PR.
4. En la SFPR: Sitio web → Dominio → `sfpr.com.ar` → copiar los registros en NIC Argentina sin
   tocar los `MX` → "Comprobar ahora".

### Paso a paso en la pantalla

En NIC Argentina sólo se elige **quién** administra el DNS (la delegación); los registros se
cargan en ese proveedor. La pantalla consulta el DNS público del dominio y arma un paso a paso:
1. dónde se administra (detectado por los servidores NS: Cloudflare, DonWeb, Hostinger, GoDaddy,
   Route 53…; si no lo reconoce, muestra el dominio del NS y explica cómo verlo en nic.ar);
2. cómo llegar a la zona DNS en ese proveedor;
3. la tabla de registros con «Copiar»;
4. qué no tocar — si hay registros MX, avisa en rojo que el dominio recibe correo;
5. volver y tocar «Comprobar ahora».

**SFPR (consultado el 02/10/2026):** DNS en **Cloudflare** (`elma`/`ivan.ns.cloudflare.com`),
**sin registros MX** (no recibe correo en el dominio), `A @ → 52.6.83.27` y
`www → website.alboompro.com` (la web vieja de Alboom). En Cloudflare los dos registros nuevos
tienen que quedar con la nube **gris** («Solo DNS»).

## 6. Pruebas

- Unitarias: normalización del dominio, decisión del filtro de entrada (qué se reescribe, qué
  se redirige, qué pasa sin tocar), armado de los registros DNS.
- Manual en producción: `curl -H "Host: sfpr.com.ar"` contra el deploy antes de tocar el DNS.
