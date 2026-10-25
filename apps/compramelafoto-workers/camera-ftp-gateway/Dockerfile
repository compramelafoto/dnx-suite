# Servidor de FTP para la Conexión de Cámara (y las credenciales de agencia).
#
# Se construye desde la RAÍZ del monorepo, porque depende de @repo/db, de
# @repo/geo y de una parte del código de la app (apps/compramelafoto/lib):
#   docker build -f apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile .
#   fly deploy . -c apps/compramelafoto-workers/camera-ftp-gateway/fly.toml \
#     --dockerfile apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile \
#     --ha=false
# Guía completa: apps/compramelafoto-workers/deploy/README.md
#
# El servidor se queda escuchando: FTP en el 21, datos pasivos en
# 50000-50050 y /health en el 8080.

FROM node:20-bookworm-slim

# openssl lo pide Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /repo

# Manifiestos primero: así un cambio de código no invalida la capa de módulos.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json* ./
COPY packages/db/package.json packages/db/
COPY packages/geo/package.json packages/geo/
COPY packages/ops-daily-report/package.json packages/ops-daily-report/
COPY packages/partners/package.json packages/partners/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/compramelafoto-workers/camera-ftp-gateway/package.json apps/compramelafoto-workers/camera-ftp-gateway/

# El schema tiene que estar antes de instalar: el postinstall de @repo/db
# corre `prisma generate` y sin el schema falla.
COPY packages/db/prisma packages/db/prisma

RUN pnpm install --frozen-lockfile --filter compramelafoto-camera-ftp-gateway...

COPY packages/db packages/db
COPY packages/geo packages/geo
COPY packages/ops-daily-report packages/ops-daily-report
COPY packages/partners packages/partners
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config packages/eslint-config
COPY apps/compramelafoto-workers/camera-ftp-gateway apps/compramelafoto-workers/camera-ftp-gateway

# El servidor importa código de la app (`@/lib/...`, ver tsconfig.json). Va
# sólo la carpeta lib: no hace falta app/ ni node_modules de la app.
#   - Los paquetes npm que usa esa lib (@aws-sdk, @prisma/client, @repo/geo…)
#     se declaran en el package.json del servidor; el enlace de node_modules
#     hace que Node los encuentre desde apps/compramelafoto/lib.
#   - El package.json mínimo con "type": "module" hace que esa lib se cargue
#     como módulos modernos (sin él, Node la toma como CommonJS y falla al
#     importar por nombre).
#     OJO, es frágil: desde acá esos archivos de lib corren como ESM, así que
#     no pueden usar `require` ni `__dirname`. Si alguno lo hace, el servidor
#     deja de arrancar en la imagen (y localmente no se nota).
COPY apps/compramelafoto/lib apps/compramelafoto/lib
RUN printf '{ "name": "compramelafoto-lib-para-ftp", "private": true, "type": "module" }\n' \
      > apps/compramelafoto/package.json \
    && ln -s /repo/apps/compramelafoto-workers/camera-ftp-gateway/node_modules \
             /repo/apps/compramelafoto/node_modules

# Prisma de nuevo: el COPY anterior pudo sobrescribir el cliente generado.
RUN pnpm --filter @repo/db exec prisma generate

WORKDIR /repo/apps/compramelafoto-workers/camera-ftp-gateway

EXPOSE 21 50000-50050 8080

CMD ["pnpm", "start"]
