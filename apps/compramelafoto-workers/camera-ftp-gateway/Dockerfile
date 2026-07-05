FROM node:20-bookworm-slim

WORKDIR /app

# Monorepo: schema Prisma + lib compartida
COPY prisma ./prisma
COPY lib ./lib
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npx prisma generate --schema prisma/schema.prisma

COPY camera-ftp-gateway/package.json camera-ftp-gateway/package-lock.json ./camera-ftp-gateway/
WORKDIR /app/camera-ftp-gateway
RUN npm ci --omit=dev

COPY camera-ftp-gateway ./

EXPOSE 21
EXPOSE 50000-50050
EXPOSE 8080

CMD ["npm", "run", "start"]
