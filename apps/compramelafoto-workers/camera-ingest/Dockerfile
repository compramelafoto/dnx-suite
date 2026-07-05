FROM node:20-bookworm-slim

WORKDIR /app

# Monorepo: schema Prisma + lib compartida
COPY prisma ./prisma
COPY lib ./lib
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npx prisma generate --schema prisma/schema.prisma

COPY camera-ingest-worker/package.json camera-ingest-worker/package-lock.json ./camera-ingest-worker/
WORKDIR /app/camera-ingest-worker
RUN npm ci --omit=dev

COPY camera-ingest-worker ./

CMD ["npm", "run", "start"]
