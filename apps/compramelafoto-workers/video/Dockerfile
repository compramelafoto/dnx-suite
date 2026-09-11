# Worker de video para Cloud Run Job (ejecución efímera).
#
# Se construye desde la RAÍZ del monorepo, porque el worker depende de @repo/db:
#   gcloud builds submit --config apps/compramelafoto-workers/video/cloudbuild.yaml .
#
# El contenedor no queda escuchando: corre `drain`, procesa lo que haya en la
# cola y termina. Cloud Run factura sólo esos segundos.

FROM node:20-bookworm-slim

# ffmpeg y ffprobe son el corazón del worker; openssl lo pide Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
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
COPY apps/compramelafoto-workers/video/package.json apps/compramelafoto-workers/video/

# El schema tiene que estar antes de instalar: el postinstall de @repo/db
# corre `prisma generate` y sin el schema falla.
COPY packages/db/prisma packages/db/prisma

RUN pnpm install --frozen-lockfile --filter compramelafoto-video-worker...

COPY packages/db packages/db
COPY packages/ops-daily-report packages/ops-daily-report
COPY packages/partners packages/partners
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config packages/eslint-config
COPY apps/compramelafoto-workers/video apps/compramelafoto-workers/video

# Prisma de nuevo: el COPY anterior pudo sobrescribir el cliente generado.
RUN pnpm --filter @repo/db exec prisma generate

WORKDIR /repo/apps/compramelafoto-workers/video

# Cloud Run monta /tmp en memoria: el original se descarga ahí, así que la
# memoria del job tiene que superar el video más grande que acepte la app.
ENV TMPDIR=/tmp

CMD ["pnpm", "drain"]
