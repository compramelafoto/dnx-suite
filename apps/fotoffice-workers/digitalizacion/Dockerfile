# Worker de digitalización (conversión de grabaciones) para Cloud Run Job.
#
# Se construye desde la RAÍZ del monorepo, porque el worker depende de @repo/db:
#   gcloud builds submit --config apps/fotoffice-workers/digitalizacion/cloudbuild.yaml .
#
# El contenedor no queda escuchando: corre `drain`, procesa la cola y termina.

FROM node:20-bookworm-slim

# ffmpeg convierte; fonts-dejavu-core da la tipografía de la placa de marca
# (sharp/librsvg la busca como "DejaVu Sans"); openssl lo pide Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /repo

# Manifiestos primero: así un cambio de código no invalida la capa de módulos.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json* ./
COPY packages/db/package.json packages/db/
COPY packages/ops-daily-report/package.json packages/ops-daily-report/
COPY packages/partners/package.json packages/partners/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/fotoffice-workers/digitalizacion/package.json apps/fotoffice-workers/digitalizacion/

# El schema tiene que estar antes de instalar: el postinstall de @repo/db
# corre `prisma generate` y sin el schema falla.
COPY packages/db/prisma packages/db/prisma

RUN pnpm install --frozen-lockfile --filter fotoffice-digitalizacion-worker...

COPY packages/db packages/db
COPY packages/ops-daily-report packages/ops-daily-report
COPY packages/partners packages/partners
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config packages/eslint-config
COPY apps/fotoffice-workers/digitalizacion apps/fotoffice-workers/digitalizacion

# Prisma de nuevo: el COPY anterior pudo sobrescribir el cliente generado.
RUN pnpm --filter @repo/db exec prisma generate

WORKDIR /repo/apps/fotoffice-workers/digitalizacion

# Sin disco para el video: cada tramo entra a ffmpeg por un descriptor propio (pipe:N) y la
# salida se sube en streaming. En /tmp sólo queda la placa de marca (PNG).
ENV TMPDIR=/tmp
# Más hilos de libuv (R2, archivos y DNS no se pisan entre sí).
ENV UV_THREADPOOL_SIZE=16

CMD ["pnpm", "drain"]
