# Servidor de FTP de ComprameLaFoto: guía para ponerlo en línea

> Estado: **preparado, pero NO desplegado.** Mientras no sigas esta guía, en el
> panel sigue apareciendo "Servidor FTP aún no disponible".

## Qué es y para qué sirve

Es un programa que recibe por FTP las fotos que mandan las cámaras (la
"Conexión de Cámara" de los fotógrafos y las credenciales de agencia). Cada
JPG que llega se guarda en R2 (el almacenamiento de fotos) y queda anotado en
la base de datos como "pendiente de procesar".

**Quién convierte ese JPG en una foto del álbum:** el cron de Vercel
`/api/cron/process-camera-ingest-jobs`, que ya está activo. Por eso **no hace
falta** correr el `camera-ingest` aparte; el contenedor de `camera-ingest` es
opcional y sólo sirve si quisieras procesar más rápido que el cron.

## Qué necesitás

- Una cuenta en [Fly.io](https://fly.io) con tarjeta cargada.
- La herramienta `fly` instalada en tu computadora (`brew install flyctl`) y
  la sesión iniciada (`fly auth login`).
- Una **IP pública dedicada (IPv4)**: cuesta unos 2 USD por mes. Es
  obligatoria: las cámaras necesitan una dirección fija para el modo pasivo.
- La máquina del servidor: unos 3 a 5 USD por mes (1 máquina chica,
  siempre encendida, en Buenos Aires).
- Los datos de conexión de producción (los mismos que usa la app):
  `DATABASE_URL` y las claves de R2.
- Acceso al DNS de `compramelafoto.com` y al panel de Vercel.

Todos los comandos se escriben **desde la carpeta raíz del repositorio**
(`dnx-suite`), no desde dentro de una app.

## Pasos

### 1. Crear la aplicación en Fly (una sola vez)

```bash
fly apps create clf-camera-ftp
```

Si el nombre ya está tomado, elegí otro y cambiá `app = "..."` en
`apps/compramelafoto-workers/camera-ftp-gateway/fly.toml`.

### 2. Reservar la IP pública fija

```bash
fly ips allocate-v4 -a clf-camera-ftp
```

Anotá la dirección que muestra (por ejemplo `203.0.113.10`). La vas a usar
en los pasos 3 y 4. Se puede ver de nuevo con `fly ips list -a clf-camera-ftp`.

### 3. Cargar los secretos

Los secretos **no se escriben en ningún archivo**: se cargan directo en Fly.
Reemplazá cada `...` por el valor real de producción.

```bash
fly secrets set -a clf-camera-ftp \
  DATABASE_URL="..." \
  R2_ACCOUNT_ID="..." \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_ENDPOINT="..." \
  R2_BUCKET_NAME="..." \
  FTP_PASV_URL="203.0.113.10"
```

Qué es cada una:

| Variable | Obligatoria | Qué es |
|---|---|---|
| `DATABASE_URL` | Sí | Base de datos de producción de CLF (la misma que usa la app). |
| `R2_ACCOUNT_ID` | Sí | Cuenta de Cloudflare R2. |
| `R2_ACCESS_KEY_ID` | Sí | Clave de acceso de R2. |
| `R2_SECRET_ACCESS_KEY` | Sí | Clave secreta de R2. |
| `R2_ENDPOINT` | Sí | Dirección de R2 (`https://<cuenta>.r2.cloudflarestorage.com`). |
| `R2_BUCKET_NAME` (o `R2_BUCKET`) | Sí, una de las dos | Nombre del bucket de fotos de producción. |
| `FTP_PASV_URL` | Sí en la práctica | La IP del paso 2. Sin ella las cámaras se conectan pero no pueden subir. |

Estas otras ya vienen puestas en `fly.toml` y no hace falta tocarlas:
`CAMERA_CONNECTION_FTP_PORT` (21), `FTP_PASV_MIN_PORT` (50000),
`FTP_PASV_MAX_PORT` (50050), `FTP_MAX_UPLOAD_BYTES` (30 MB) y `HEALTH_PORT`
(8080). Opcionales, con su valor por defecto: `FTP_RATE_LIMIT_WINDOW_MS`
(600000 = 10 minutos) y `FTP_RATE_LIMIT_MAX_FILES` (60 archivos por ventana).

> `DATABASE_URL` y las claves de R2 tienen que ser **exactamente las de
> producción** de la app; si apuntan a otra base, las cámaras subirían fotos
> a un lugar donde nadie las ve.

### 4. Desplegar

```bash
fly deploy . -c apps/compramelafoto-workers/camera-ftp-gateway/fly.toml \
  --dockerfile apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile \
  --ha=false
```

El `.` del principio es importante: le dice a Fly que use la raíz del
repositorio como carpeta de trabajo. `--ha=false` evita que Fly cree dos
máquinas. La primera vez tarda varios minutos.

Después asegurate de que quede **una sola máquina**:

```bash
fly scale count 1 -a clf-camera-ftp
```

Tiene que ser una sola porque en FTP pasivo la cámara abre dos conexiones
(control y datos) y las dos deben llegar a la misma máquina; con dos máquinas
las subidas fallarían al azar.

Cuando termine, comprobá que está vivo:

```bash
fly status -a clf-camera-ftp
fly logs -a clf-camera-ftp
```

En los logs tiene que aparecer `ftp_listening`. Si dice `Config inválida`, falta
alguno de los secretos del paso 3.

### 5. Apuntar el nombre `ftp.compramelafoto.com` a la IP

En el DNS de `compramelafoto.com` creá un registro **A**:

- Nombre: `ftp`
- Valor: la IP del paso 2
- Si el DNS está en Cloudflare, dejalo **sin proxy** (nube gris, "solo DNS").
  El proxy de Cloudflare no sirve para FTP.

### 6. Encender la función en la app (Vercel)

En el proyecto de Vercel de CLF (`compramelafoto-dnxsuite`), en Production,
cargá estas dos variables y volvé a desplegar:

- `CAMERA_CONNECTION_FTP_SERVER_LIVE` = `true`
- `CAMERA_CONNECTION_FTP_HOST` = `ftp.compramelafoto.com`

Recién ahí desaparece el cartel "Servidor FTP aún no disponible".

### 7. Probar

Con FileZilla (o cualquier programa de FTP):

- Servidor: `ftp.compramelafoto.com`, puerto `21`
- Usuario y contraseña: los que muestra el panel (fotógrafo o agencia)
- Modo de transferencia: **pasivo**
- Subí un JPG de prueba. Tiene que aparecer en el álbum en uno o dos minutos
  (lo procesa el cron de Vercel).
- **Comprobá expresamente que la subida en modo pasivo funciona** a través
  del proxy de Fly: el servidor (ftp-srv) exige que la conexión de datos venga
  de la misma dirección que la de control. Si la conexión se establece pero la
  subida falla o se cuelga, lo primero a revisar es que la app tenga la IPv4
  dedicada del paso 2 (`fly ips list -a clf-camera-ftp`) y que `FTP_PASV_URL`
  sea esa misma IP.

Prueba automática con el script del repositorio:

```bash
cd apps/compramelafoto-workers/camera-ftp-gateway
FTP_HOST=ftp.compramelafoto.com FTP_USER="<usuario>" FTP_PASS="<contraseña>" pnpm smoke-test
```

## Advertencia: tamaño de las fotos

La app acepta como máximo **10 MB por foto** (`MAX_FILE_SIZE`); el servidor de
FTP deja pasar hasta 30 MB. Una foto de entre 10 y 30 MB llega por FTP, pero
después la app no la procesa. Pedile a los fotógrafos que configuren la
cámara en **JPG calidad mediana o fina** (no RAW, no "extra fina" ni TIFF).

## Mantenimiento

- Ver qué está pasando: `fly logs -a clf-camera-ftp`
- Actualizar tras cambios de código: repetir el paso 4.
- Apagarlo: `fly scale count 0 -a clf-camera-ftp` (las cámaras dejan de poder
  subir; el panel seguirá mostrando que el servidor está disponible hasta que
  pongas `CAMERA_CONNECTION_FTP_SERVER_LIVE` en `false`).
- Rotar una clave de R2: repetir `fly secrets set` con el valor nuevo.

## Alternativa: un servidor propio (VPS)

Con Docker instalado, desde la raíz del repositorio:

```bash
cp apps/compramelafoto-workers/camera-ftp-gateway/.env.example \
   apps/compramelafoto-workers/deploy/camera-connection/.env
# completar los valores (incluida FTP_PASV_URL = IP pública del servidor)
docker compose -f apps/compramelafoto-workers/deploy/camera-connection/docker-compose.yml up -d --build
```

Hay que abrir en el firewall los puertos 21, 50000-50050 y 8080.

## Para quien mantiene el código

- La imagen se arma desde la raíz del monorepo. Incluye
  `apps/compramelafoto/lib` (el servidor importa `@/lib/...`), pero no `app/`
  ni los `node_modules` de la app.
- Los paquetes npm que usa esa lib están declarados en el `package.json` del
  servidor, y el Dockerfile los enlaza hacia `apps/compramelafoto/lib`.
- `pnpm --filter compramelafoto-camera-ftp-gateway dev` **no arranca en
  local**: el `package.json` de `apps/compramelafoto` no es `type: module` y su
  lib se carga como CommonJS. Para simular la imagen: poner temporalmente
  `{"name":"x","type":"module"}` como `apps/compramelafoto/package.json`,
  mover `apps/compramelafoto/node_modules` y enlazar ahí el `node_modules` del
  gateway, correr `pnpm start` con variables falsas (ver `.env.example`) y
  mirar `/health`; después restaurar con `git checkout`.
- Fragilidad: los archivos de `apps/compramelafoto/lib` que usa el servidor
  tienen que seguir siendo compatibles con ESM (sin `require` ni `__dirname`).
- Los otros trabajadores (`camera-ingest`, `video`) tienen su propia guía; el
  de video ya tiene su Dockerfile para Cloud Run.
